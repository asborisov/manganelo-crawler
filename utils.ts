export const promiseLog = <T>(value: T): Promise<T> => {
    console.log(value);
    return Promise.resolve(value);
};
