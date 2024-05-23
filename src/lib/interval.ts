import { Constants, Environment } from "./constants.js";

/**
 * Manages intervals
 */
export class IntervalManager {
    private interval: number;
    private callbacks: (() => void)[] = [];    
    private delay: number = 0;
    
    public constructor(interval: number) {
        this.interval = interval;
    }

    public attach(callback: () => Promise<void>): void {
        this.callbacks.push(callback);
    }

    public start(): void {
        this.callbacks.forEach(async callback => await callback());

        if (!Environment.PROD) {
            this.callbacks.forEach(async callback => await callback());
        }

        setTimeout(() => {
            setInterval(async () => {
                this.callbacks.forEach(async callback => await callback());
            }, this.interval);
        }, this.delay);
    }

    public setDelay(delay: number): void {
        this.delay = delay;
    }
}

export const minuteInterval = new IntervalManager(Constants.MIN_MS);
export const hourInterval = new IntervalManager(Constants.HOUR_MS);

hourInterval.setDelay(Constants.HOUR_MS - Date.now() % Constants.HOUR_MS);