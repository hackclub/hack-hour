// The hack hour cli!

import { Command } from 'commander';

const program = new Command();

const apiEndpoint = 'https://hack-hour.manitej.hackclub.app/api/';
const slackId = 'U04QD71QWS0';
const apiKey = 'bc5dc530-d4b8-402e-99e0-d9393d45e64d';

program
    .version('0.0.1')
    .description('A hack hour CLI')

program.action(() => {
    fetch(apiEndpoint + 'session/' + slackId)
        .then(res => res.json())
        .then(data => {
            console.log(JSON.stringify(data, null, 2));
        });
});

program.command('start')
    .description('start a new hack hour')
    .argument('<work>', 'the work you are doing')
    .action((work) => {
        console.log('Starting a new hack hour');

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
            .then(data => {
                console.log(JSON.stringify(data, null, 2));
            });
    });

program.command('pause')
    .description('pause the current hack hour')
    .action(() => {
        console.log('Pausing the current hack hour');
        
        fetch(apiEndpoint + 'pause', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
        })
            .then(res => res.json())
            .then(data => {
                console.log(JSON.stringify(data, null, 2));
            });
    });

program.command('cancel')
    .description('cancel the current hack hour')
    .action(async () => {
        console.log('Cancelling the current hack hour');

        fetch(apiEndpoint + 'cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
        })
            .then(res => res.json())
            .then(data => {
                console.log(JSON.stringify(data, null, 2));
            });
    });

program.parse(process.argv);