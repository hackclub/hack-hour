// An abstraction for the hack hour database, in case I want to ever replace it with a real database.
import { Low } from 'lowdb';
import { Constants } from './lib/constants.js';
import { JSONFile, JSONFilePreset } from 'lowdb/node';

export const CURRENT_VERSION = "1.1";
export type Version = "1.1"; // Pixie Version Management

export type User = {
  version: Version,
  totalHours: number,
  userFlags: { // TODO: implement typing for flags
    [flag: string]: any
  },
}

export type HackHourSession = {
  messageTs: string,
  hourStart: Date, // Keeping this in case, will probably remove later 
  template: string,
  elapsed: number,
  work: string
}

export type DatabaseStructure = {
  globalFlags: {
    [flag: string]: any
  },
  users: {
    [userId: string]: User
  },
  hackHourSessions: {
    [userId: string]: HackHourSession
  }
}

const DEFAULT_DATA: DatabaseStructure = {
  globalFlags: {},
  users: {},
  hackHourSessions: {}
}

export class Database {
  db: Low<DatabaseStructure> | null;

  constructor() {
    this.db = null;
  }

  async init() {
    this.db = await JSONFilePreset(Constants.FILE_PATH, DEFAULT_DATA);
  }

  // Sessions

  async createSession(user: string, session: HackHourSession) {
    if (this.db) {
      this.db.data.hackHourSessions[user] = session;
      await this.db.write();
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async getSession(user: string): Promise<HackHourSession | undefined> {
    if (this.db) {
      return this.db.data.hackHourSessions[user];
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async deleteSession(user: string) {
    if (this.db) {
      delete this.db.data.hackHourSessions[user];
      await this.db.write();
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async isInSession(user: string): Promise<boolean> {
    if (this.db) {
      return this.db.data.hackHourSessions[user] !== undefined;
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async updateSession(user: string, session: HackHourSession) {
    if (this.db) {
      this.db.data.hackHourSessions[user] = session;
      await this.db.write();
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async listSessions(): Promise<string[]> {
    if (this.db) {
      return Object.keys(this.db.data.hackHourSessions);
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  // Users

  async createUser(userId: string, data: User) {
    if (this.db) {
      this.db.data.users[userId] =data
      await this.db.write();
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async isUser(userId: string): Promise<boolean> {
    if (this.db) {
      return this.db.data.users[userId] !== undefined;
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async getUser(userId: string): Promise<User | null> {
    if (this.db) {
      return this.db.data.users[userId];
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async getUserFlag(userId: string, flag: string): Promise<any> {
    if (this.db) {
      return this.db.data.users[userId].userFlags[flag];
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async setUserFlag(userId: string, flag: string, value: any) {
    if (this.db) {
      this.db.data.users[userId].userFlags[flag] = value;
      await this.db.write();
    } else {
      throw new Error("The database is not initialized!");
    }
  }

  async listUsers(): Promise<string[]> {
    if (this.db) {
      return Object.keys(this.db.data.users);
    } else {
      throw new Error("The database is not initialized!");
    }
  }
}