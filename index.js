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
    .option('-e, --elliptic',
        'Flag users lacking elliptic keys (no flagging by default)')
    .parse(process.argv);

if (!program.token) {
    console.log(
        'User token with write:org rights is required! Generate one at https://github.com/settings/tokens/new'
    );
    console.log("See 'node index.js --help' for more information.");
    process.exit(1);
}

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
    protocol: 'https',
    host: 'api.github.com', // should be api.github.com for GitHub
    timeout: 5000,
    headers: {
        'user-agent': 'shuadit' // GitHub is happy with a unique user agent
    }
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
    console.log('Loading users; please wait...');
    buildUserList(false, null, addKeys, printList);
}

function printList() {
    var colWidths, table;

    if (program.elliptic) {
        // we're going to need a bigger table!
        colWidths = [30, 50, 10, 40, 20];
    } else {
        colWidths = [30, 50, 10, 30, 20];
    }
    table = new Table({
        head: ['Username', 'Url', 'Count', 'Type(s)', 'Size(s)'],
        colWidths: colWidths
    });

    for (var user in userList) {
        if (userList.hasOwnProperty(user)) {
            table.push([user, userList[user].url, userList[user].keyCount,
                userList[user].keyTypes, userList[user].keyBits
            ]);
        }
    }

    console.log(table.toString());
}

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

                    // don't run the key length if it's not RSA or DSA
                    if (gitKey.getKeyType() === 'ssh-rsa' || gitKey.getKeyType() ===
                        'ssh-dsa' || gitKey.getKeyType() === 'ssh-dss') {
                        if (gitKey.getKeyLength() <= program.size) {
                            keyBits.push(chalk.bgRed.bold(gitKey.getKeyLength()));
                        } else {
                            keyBits.push(gitKey.getKeyLength());
                        }
                    }
                }

                if (keyCount === 0) {
                    userList[this.user].keyCount = chalk.bgRed.bold(
                        keyCount);
                } else {
                    userList[this.user].keyCount = keyCount;
                }

                // deduplicate keytypes
                userList[this.user].keyTypes = keyTypes.filter(function(
                    item, pos) {
                    return keyTypes.indexOf(item) === pos;
                });

                if (program.elliptic && keyTypes.filter(function(n) {
                        return ellipticKeyTypes.indexOf(n) !== -1;
                    }).length === 0) {
                    // intersect the keyTypes for the user and the ellipticKeyTypes; if the intersected array is empty, they don't have an eliptic key
                    userList[this.user].keyTypes.push(chalk.bgRed.bold(
                        'No eliptic keys'));
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

    resultsPage.forEach(function(user) {
        var userObj = {
            url: user.html_url
        };

        userList[user.login] = userObj;
    });

    if (github.hasNextPage(resultsPage)) {
        github.getNextPage(resultsPage, function(err, res) {
            buildUserList(err, res, callback, callback2);
        });
    } else {
        callback(callback2);
    }
}
