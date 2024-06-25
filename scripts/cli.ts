// The hack hour cli!

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

const apiEndpoint = 'https://hackhour.hackclub.com/api/';
const slackId = 'YOUR_SLACK_ID_HERE';
const apiKey = 'YOUR_API_KEY_HERE';

const error = chalk.bold.hex('#e63737');
const finish = chalk.bold.bgHex('#37e637');

program
    .version('0.0.1')
    .description('A hack hour CLI')

program.action(() => {
    fetch(apiEndpoint + 'session/' + slackId)
        .then(res => res.json())
        .then(res => {
            if (!res || !res.ok) {
                console.log(`${error('Error:')} ${res?.error ?? 'An error occurred - no data recieved'}`);
            } else {
                if (res.data.completed) {
                    console.log(finish('You have completed your hack hour!'));
                } else if (res.data.paused) {
                    console.log(chalk.bgBlueBright('You have paused your hack hour!'));
                } else {
                    console.log(chalk.inverse(`You have ${res.data.remaining} minutes left!`));
                }

                console.log(chalk.bold('Work: ') + res.data.work);
                console.log(chalk.bold('Goal: ') + res.data.goal);
                console.log(chalk.bold('Started at: ') + res.data.createdAt);
                console.log(chalk.bold('Estimated end: ') + res.data.endTime);
            }
        });
});

program.command('start')
    .description('start a new hack hour')
    .argument('<work>', 'the work you are doing')
    .action((work) => {
        fetch(apiEndpoint + 'start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                work: work
            })
        })
            .then(res => res.json())
            .then(res => {
                if (res.ok) {
                    console.log('Hack hour started! You have 60 minutes to complete it!');
                } else {
                    console.log(`${error('Error:')} ${res.error ?? 'An error occurred'}`);
                }
            });
    });

program.command('pause')
    .description('pause the current hack hour')
    .action(() => {        
        fetch(apiEndpoint + 'pause', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
        })
            .then(res => res.json())
            .then(res => {
                if (res.ok) {
                    if (res.data.paused) {
                        console.log('Hack hour paused');
                    } else {
                        console.log('Hack hour resumed');
                    }
                } else {
                    console.log(`${error('Error:')} ${res.error ?? 'An error occurred'}`);
                }
            });
    });

program.command('cancel')
    .description('cancel the current hack hour')
    .action(async () => {
        fetch(apiEndpoint + 'cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
        })
            .then(res => res.json())
            .then(res => {
                if (res.ok) {
                    console.log("Paused the hack hour!");
                } else {
                    console.log(`${error('Error:')} ${res.error ?? 'An error occurred'}`);
                }
            });
    });

program.parse(process.argv);