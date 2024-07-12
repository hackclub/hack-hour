import dotenv from 'dotenv';
dotenv.config({});

import { app } from './bolt';
import main from './poll';

try {
    await app.start(process.env.REVIEW_PORT || 5876);

    console.log(`\n\n\n\n\nReview Begun! Running on port ${process.env.REVIEW_PORT || 5876}...\n\n\n\n\n`);
    
    main();
} catch (error) {
    console.error(error);

    await app.stop();
    
    process.exit(1);        
}