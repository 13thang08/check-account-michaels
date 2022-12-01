let checkAccount = require('./check-account');
let fs = require('fs');

async function main() {
    let accounts = fs.readFileSync('./mailpass.txt', 'utf-8').split('\n');
    let rows = '';
    for (let i = 0; i < accounts.length; i++) {
        let account = accounts[i];
        let info = account.trim().split('|');
        let accountName = info[0].trim();
        let password = info[1].trim();
        if (accountName && password) {
            console.log(`Processing ${i+1}/${accounts.length}`)
            let check = await checkAccount(accountName, password);
            let row = `${accountName}|${password}|${check}`;
            console.log(row);
            rows = rows + row + '\n';
            fs.writeFileSync('./result.txt', rows, 'utf-8');
        }
    }
}

main();