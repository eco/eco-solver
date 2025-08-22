import mongoose from 'mongoose';
export declare class DBTestUtils {
    private connection;
    getRandomString(len: number): string;
    dbOpen(): Promise<mongoose.Connection>;
    dbClose(): Promise<any>;
}
