import { welcome, WELCOME_CALLBACK_ID } from "./welcome.js";
import { setup, SETUP_CALLBACK_ID } from "./setup.js";
import { instructions, INSTRUCTIONS_CALLBACK_ID } from "./instructions.js";
import { goals, GOALS_CALLBACK_ID, goalCreate, CREATE_GOAL_CALLBACK_ID, goalDelete, DELETE_GOAL_CALLBACK_ID } from "./goals.js";
import { start, START_CALLBACK_ID } from "./start.js";

export const Views = {
  WELCOME: welcome,
  SETUP: setup,
  INSTRUCTIONS: instructions,
  GOALS: goals,
  CREATE_GOAL: goalCreate,
  DELETE_GOAL: goalDelete,
  START: start
}

export const CALLBACK_ID = {
  WELCOME: WELCOME_CALLBACK_ID,
  SETUP: SETUP_CALLBACK_ID,
  INSTRUCTIONS: INSTRUCTIONS_CALLBACK_ID,
  GOALS: GOALS_CALLBACK_ID,
  CREATE_GOAL: CREATE_GOAL_CALLBACK_ID,
  DELETE_GOAL: DELETE_GOAL_CALLBACK_ID,
  START: START_CALLBACK_ID,
  GOALS_ERROR: 'goalsError',
  STATS: 'stats',
}

export const ACTION_ID = {
  SELECT_GOAL: 'selectGoal',
  SET_DEFAULT: 'setDefault',
  CREATE_GOAL: 'createGoal',
  DELETE_GOAL: 'deleteGoal'
}