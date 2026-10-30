import {getD1} from './database.mjs';
export const env={get DB(){return getD1() as unknown as D1Database;}};
