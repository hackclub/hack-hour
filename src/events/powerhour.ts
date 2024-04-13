// This is the main file for the powerhour event.
        
import { BaseEvent } from "./baseEvent.js";

export class PowerHour extends BaseEvent {
    async endSession(
        session: { 
            messageTs: string; 
            userId: string; 
            template: string; 
            goal: string; 
            task: string; 
            time: number; 
            elapsed: number; 
            completed: boolean; 
            attachment?: string | undefined; 
            cancelled: boolean; 
            createdAt?: string | undefined; 
        }
    ): Promise<void> {

    }
}