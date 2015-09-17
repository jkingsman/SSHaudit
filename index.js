#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander'),
    GitHubApi = require('github'),
    Table = require('cli-table'),
    chalk = require('chalk'),
    opensshparser = require('openssh-rsa-dsa-parse');

var githubUser, userList = [],
    ellipticKeyTypes = ['ssh-ed25519', 'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'
    ];

program
    .version('0.1.0')
    .option('-t, --token [token]', 'Your user token (required)')
    .option('-o, --organization [org name]',
        'Your organization name (omit to see a list of organizations you have membership in)'
    )
    .option('-s, --size [keysize]',
        'Keys smaller than this keysize in bits will be flagged (default = 1024; elliptic keys will not have their lengths displayed irrespective of this setting)',
        1024)
    .option('-c, --count [number]',
        'Users with fewer than this number of keys will be flagged (default = 1))',
        1)
    .option('-e, --elliptic',
        'Flag users lacking elliptic keys (no flagging by default)')
    .option('-f, --flaggedonly',
        'Only display users who are flagged according to the previous rules')
    .parse(process.argv);

if (!program.token) {
    console.log(
        'User token with write:org rights is required! Generate one at https://github.com/settings/tokens/new'
    );
    console.log("See 'node index.js --help' for more information.");
    process.exit(1);
}

/**
 * Prints an error if one occured and closes the program
 * @param {json} err - JSON object containing error details
 */
function handleErrorIfOccurs(err) {
    if (err) {
        console.log('Error!');
        console.log(err);
        process.exit(1);
    }
}

// set up a client instance
var github = new GitHubApi({
    version: '3.0.0',
    // debug: true,
    protocol: 'https'
});

github.authenticate({
    type: 'oauth',
    token: program.token
});

// set up the current user
github.user.get(function(err, res) {
    handleErrorIfOccurs(err);
    githubUser = res.login;
});

if (!program.organization) {
    // not provided an org; list current ones
    listOrgs();
} else {
    console.log(
        'Loading users; please wait... (this may take a while for large organizations)'
    );
    buildUserList(false, null, addKeys, printList);
}

/**
 * Prints the user list in table form
 */
function printList() {
    var table = new Table({
        head: ['Name', 'Username', 'Count', 'Type(s)', 'Size(s)']
    });

    for (var user in userList) {
        if ((userList.hasOwnProperty(user) && !program.flaggedonly) || (
                userList.hasOwnProperty(user) && userList[user].isFlagged)) {
            /* K-map reduction of this:
             *      A	B	C	Y
             *      0	0	0	0
             *    	0	0	1	0
             *    	0	1	0	0
             *    	0	1	1	0
             *    	1	0	0	1
             *    	1	0	1	0
             *    	1	1	0	1
             *    	1	1	1	1
             *  where A = hasOwnProperty, B = userList[user].isFlagged,
             *  C = program.flaggedonly, Y = should show entry
             */
            table.push([userList[user].realName, user, userList[user].keyCount,
                userList[user].keyTypes.join(', '), userList[user].keyBits
                .join(', ')
            ]);
        }
    }

    console.log(table.toString());
    github.misc.rateLimit({}, function(err, ratelimit) {
        handleErrorIfOccurs(err);
        var percentageUsed = Math.round((ratelimit.resources.core.limit -
                ratelimit.resources.core.remaining) / ratelimit.resources
            .core.limit * 1000, 2) / 10;
        var resetDate = new Date(parseInt(ratelimit.resources.core.reset +
            '000', 10)); // ghetto, I know
        var formattedResetDate = resetDate.toISOString().replace(/T/,
            ' ').replace(/\..+/, '');
        console.log('You have used ' + percentageUsed +
            '% of your GitHub API requests (resets on ' +
            formattedResetDate + ' )');
    });
}

/**
 * Adds keys to an existing user list
 * @param {requestCallback} callback - callback to handle the completely built list
 */
function addKeys(callback) {
    var userUpdatesInProgress = Object.keys(userList).length;

    for (var user in userList) {
        if (userList.hasOwnProperty(user)) {
            github.user.getKeysFromUser({
                user: user
            }, function(err, keylist) {
                handleErrorIfOccurs(err);

                var keyCount = 0;
                var keyTypes = [];
                var keyBits = [];

                for (var i = 0; i < keylist.length; i++) {
                    keyCount++;

                    var gitKey = new opensshparser(keylist[i].key);

                    keyTypes.push(gitKey.getKeyType());

                    userList[this.user].isFlagged = false;

                    // don't run the key length if it's not RSA or DSA
                    if (gitKey.getKeyType() === 'ssh-rsa' || gitKey.getKeyType() ===
                        'ssh-dsa' || gitKey.getKeyType() === 'ssh-dss') {
                        if (gitKey.getKeyLength() < program.size) {
                            keyBits.push(chalk.bgRed.bold(gitKey.getKeyLength()));
                            userList[this.user].isFlagged = true;
                        } else {
                            keyBits.push(gitKey.getKeyLength());
                        }
                    }
                }

                if (keyCount < program.count) {
                    userList[this.user].keyCount = chalk.bgRed.bold(
                        keyCount);
                    userList[this.user].isFlagged = true;
                } else {
                    userList[this.user].keyCount = keyCount;
                }

                // deduplicate keytypes
                userList[this.user].keyTypes = keyTypes.filter(function(
                    item, pos) {
                    return keyTypes.indexOf(item) === pos;
                });

                if (program.elliptic &&
                    keyTypes.filter(function(n) {
                        return ellipticKeyTypes.indexOf(n) !== -1;
                    }).length === 0) {
                    // intersect the keyTypes for the user and the ellipticKeyTypes;
                    // if the intersected array is empty, they don't have an elliptic key
                    userList[this.user].keyTypes.push(chalk.bgRed.bold(
                        'No elliptic keys'));
                    userList[this.user].isFlagged = true;
                }

                // deduplicate keybits
                userList[this.user].keyBits = keyBits.filter(function(
                    item, pos) {
                    return keyBits.indexOf(item) === pos;
                });

                userUpdatesInProgress--;

                if (userUpdatesInProgress === 0) {
                    callback();
                }

            }.bind({
                user: user
            }));
        }
    }
}

/**
 * Prints a list of organizations the token owner is a part of
 */
function listOrgs() {
    github.user.getOrgs({
        user: githubUser
    }, function(err, res) {
        handleErrorIfOccurs(err);

        console.log(
            'Org Memberships (audit an org using the \'-o <organization name>\' parameter)'
        );
        res.forEach(function(org) {
            console.log(org.login);
        });
    });
}

/**
 * Adds keys to an existing user list
 * @param {json|Null} error - JSON object containing error details, or null if there are none
 * @param {json} resultsPage - JSON object containing a page of results form the user query
 * @param {requestCallback} callback - callback to handle the user list
 * @param {requestCallback} callback2 - callback passed to 'callback' as the sole parameter
 */
function buildUserList(error, resultsPage, callback, callback2) {
    handleErrorIfOccurs(error);

    // initial case; this is our first call
    if (resultsPage === null) {
        return github.orgs.getMembers({
            org: program.organization
        }, function(err, res) {
            buildUserList(err, res, callback, callback2);
        });
    }

    var resultsCount = resultsPage.length;

    resultsPage.forEach(function(user) {
        var userObj = {
            url: user.html_url
        };

        userList[user.login] = userObj;

        return github.user.getFrom({
            user: user.login
        }, function(err, userData) {
            handleErrorIfOccurs(err);

            userList[user.login].realName = userData.name ||
                '[none]';

            resultsCount--;
            if (resultsCount === 0) {
                if (github.hasNextPage(resultsPage)) {
                    github.getNextPage(resultsPage, function(
                        subErr, res) {
                        buildUserList(subErr, res,
                            callback, callback2);
                    });
                } else {
                    callback(callback2);
                }
            }
        });
    });
}
