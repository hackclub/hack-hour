import dotenv from 'dotenv';
dotenv.config({});

import { app } from './bolt';
import main from './poll';

try {
    await app.start(process.env.REVIEW_PORT || 5876);

    main();

    console.log(`Review Begun! Running on port ${process.env.REVIEW_PORT || 5876}...`);
} catch (error) {
    console.error(error);

    await app.stop();
    
    process.exit(1);        
}