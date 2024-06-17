// Typed event emitter
// Adapted from https://rjzaworski.com/2019/10/event-emitters-in-typescript

import { Session, User } from "@prisma/client";
import { Environment, Constants } from "./constants.js";
import { Server } from "http";

type EventMap = {
    init: (server: Server) => void,
    error: (error: any) => void,
    debug: (message: string) => void,

    setFlag: (flag: string, value: any) => void,

    minute: () => void,
    sessionUpdate: (update: {
        updatedSession: Session,
        updateSlack: boolean
    }) => void,
    hour: () => void,

    start: (session: Session) => void,
    complete: (session: Session) => void,
    cancel: (session: Session) => void,
    pause: (session: Session) => void,
    resume: (session: Session) => void,
    
    firstTime: (user: User) => void,
}

export type Event = keyof EventMap;

class Emitter {
    private listeners: Partial<Record<Event, Set<Function>>> = {};

    on<E extends Event>(event: E, listener: EventMap[E]) {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event]!.add(listener);
    }

    off<E extends Event>(event: E, listener: EventMap[E]) {
        if (!this.listeners[event]) {
            return;
        }
        this.listeners[event]!.delete(listener);
    }

    emit<E extends Event>(event: E, ...args: Parameters<EventMap[E]>) {
        if (!this.listeners[event]) {
            return;
        }
        this.listeners[event]!.forEach(listener => { 
            try {
                listener(...args) 
            } catch (error) {
                this.emit("error", error);
                console.error(error);
            }
        });
    }
}

export const emitter = new Emitter();

emitter.on("init", async () => {
    // if (!Environment.PROD) {
    //     emitter.emit("minute");
    // }

    setInterval(async () => {
        emitter.emit("minute");
    }, Constants.MIN_MS);    

    setTimeout(() => {
        setInterval(async () => {
            emitter.emit("minute");
        }, Constants.HOUR_MS);
    }, Constants.HOUR_MS - Date.now() % Constants.HOUR_MS);
});