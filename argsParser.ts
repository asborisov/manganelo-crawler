export type CliArguments = {
    chapters?: number;
    manga?: string;
}
const help =
    `
Simple app to save https://manganelo.com manga to pdf file. Arguments:
    -m=M, --manga=M - part of the manga URL. Can be taken from url https://manganelo.com/manga/M (default: tales_of_demons_and_gods)
    -c=N, --chapter=N - save only N first chapters. If value is negative last N chapters will be saved
`;

const isNumber = (value: any): value is number => !isNaN(parseInt(value));

export function parseArgv([_, __, ...args]: string[]): Promise<CliArguments> {
    const chapterRegExp = /(--chapters|-c)=(.*)/;
    const mangaRegExp = /(--manga|-m)=(.*)/;
    return new Promise((resolve, reject) => {
        const result: CliArguments = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            switch (true) {
                case arg.match(chapterRegExp) !== null: {
                    const value = arg.match(chapterRegExp)[2];
                    if (isNumber(value)) {
                        result.chapters = Number(value);
                        break;
                    } else {
                        return reject(`${arg} value is not a number`);
                    }
                }
                case arg.match(mangaRegExp) !== null: {
                    const value = arg.match(mangaRegExp)[2];
                    if (value) {
                        result.manga = value;
                        break;
                    } else {
                        return reject(`${arg} has empty url part`);
                    }
                }
                case arg.match(/help/) !== null: {
                    console.log(help);
                    return reject();
                }
            }
        }
        return resolve(result);
    });
}
