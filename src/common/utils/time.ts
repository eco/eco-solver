export const ONE_MINUTE = 60;

export const now = () => Math.floor(Date.now() / 1000);
export const minutes = (minutes: number) => ONE_MINUTE * minutes;
