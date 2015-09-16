# SSHaudit

Audit your GitHub organization members' SSH keys for length and type.

```bash
node index.js -t <GitHub personal token> -o <organization name>
```
![Output Screenshot](https://raw.githubusercontent.com/jkingsman/SSHaudit/master/screenshot.png)

## Installation
The following recommended installation requires [npm](https://npmjs.org/). If you are unfamiliar with npm, see the [npm docs](https://npmjs.org/doc/). Npm comes installed with Node.js since node version 0.8.x therefore you likely already have it.

Clone this repository:

```bash
git clone https://github.com/jkingsman/SSHaudit.git
```

Install the necessary dependencies:

```bash
npm install
```

## Usage

```bash
node index.js -t <GitHub personal token> -o <organization name> [-s keysize] [-c count] [-e] [-f]
```
The GitHub personal token can be generated [here](https://github.com/settings/tokens/new); it requires only the `write:org` permissions.

Omitting the organization name will list all organizations you're a member of.

### Options

`-s, --size [keysize]`

* Keys smaller than `keysize` in bits will be flagged (default = 1024)

`-c, --count [number]`

* Users with fewer than `number` keys will be flagged (default = 1)

`-e, --elliptic`

* Users lacking elliptic keys will be flagged (disabled by default)

`-f, --flaggedonly`

* Only display users who are flagged according to the previous rules (default displays all users)

## License

Licensed under the MIT License.

***

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=jkingsman&url=https%3A%2F%2Fgithub.com%2Fjkingsman%2FSSHaudit)
