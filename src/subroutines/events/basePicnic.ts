/*
The events system attempts to future-proof any events I plan to do, instead of hacking together a finicky system directly into hack hour
*/

export type Session = {
    messageTs: string;
    userId: string;
    template: string;
    goal: string;
    task: string;
    time: number;
    elapsed: number;
    completed: boolean;
    attachment: string | null;
    cancelled: boolean;
    createdAt: string | null;
};

export interface BasePicnic {
    NAME: string;
    DESCRIPTION: string;    
    ID: string;

    endSession(session: Session): Promise<void>;

    cancelSession(session: Session): Promise<void>;

    hourlyCheck(): Promise<void>; // TODO: implement necessary arguments

    userJoin(userId: string): Promise<boolean>;
}