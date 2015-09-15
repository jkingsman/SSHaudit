# SSHaudit

Audit your GitHub organization members' SSH keys for length and type.

```bash
node index.js -t <GitHub personal token> -o <organization name>
```

Output:

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
node index.js -t <GitHub personal token> -o <organization name> [-s keysize] [-e]
```
The GitHub personal token can be generated [here](https://github.com/settings/tokens/new); it requires only the `write:org` permissions.

Omitting the organization name will list all organizations you're a member of.

The `-s` flag allows you to specify which keysize in bits (and smaller) you would like to have flagged for your attention. Defaults to 1024.

Setting the `-e` flag will highlight users who do not have an elliptic curve key installed

## License

Licensed under the MIT License.

***

[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=jkingsman&url=https%3A%2F%2Fgithub.com%2Fjkingsman%2FSSHaudit)
