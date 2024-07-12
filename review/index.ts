import dotenv from 'dotenv';
dotenv.config();

import { Environment } from './constants';
import { app } from './bolt';



app.start(Environment.PORT);