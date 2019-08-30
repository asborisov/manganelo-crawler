import {launch, Page} from "puppeteer";
import * as http from "http";
import * as https from "https";
import {Sharp} from "sharp";
import {CliArguments} from "./argsParser";
import * as fs from "fs";
import {join} from "path";
import {promiseLog} from "./utils";

const sharp = require("sharp");
const PDFDocument = require('pdfkit');

type Chapter = { title: string; url: string; }

const PAGE_WIDTH = 575;
const PAGE_HEIGHT = 821;

const mangaUrl = (manga: string): string => `https://manganelo.com/manga/${manga}`;

const getImages = (page: Page): Promise<{ src: string, naturalWidth: number }[]> =>
    page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>("#vungdoc > img"), ({ src, naturalWidth }) => ({
        src,
        naturalWidth
    })));

async function getImagePaths(page: Page, chapterUrl: string): Promise<string[]> {
    await page.goto(chapterUrl);
    let imagesUrl = await getImages(page);
    if (imagesUrl.some(i => i.naturalWidth === 0)) {
        await Promise.all([
            page.click(".options-chapter .pn-option > a:not(.isactive)"),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);
        imagesUrl = await getImages(page);
    }
    return imagesUrl.map(i => i.src);
}

const getAsync = (url: string, retry: number = 0): Promise<http.IncomingMessage> => new Promise<http.IncomingMessage>(resolve => {
    https
        .get(url, resolve)
        .on("error", () => {
            if (retry > 2) throw new Error(`Can't finish request with 3 tries: ${url}`);
            else resolve(getAsync(url, retry + 1));
        });
});

async function addChapterToPdf(doc: typeof PDFDocument, page: Page, url: string, title: string): Promise<void> {
    const urls = await getImagePaths(page, url);
    await urls.reduce(
        (chain, url) => chain
            .then(() => getAsync(url))
            .then(response => response.pipe<Sharp>(sharp().resize(PAGE_WIDTH, PAGE_HEIGHT, { fit: "outside" })))
            .then(sharpStream => Promise.all([sharpStream.toBuffer(), sharpStream.metadata()]))
            .then(([buffer, meta]) => doc
                .addPage({ margin: 5, size: [meta.width + 10, meta.height + 10] })
                .image(buffer, {
                    fit: [meta.width, meta.height],
                    align: 'center',
                    valign: 'center'
                })
            )
        , Promise.resolve())
        .then(() => console.log(`Chapter '${title}' added`))
        .catch((e) => console.error(`Fail to add chapter ${title}`, JSON.stringify(e)))
}

const getChapterLinks = (page: Page): Promise<Chapter[]> =>
    page.evaluate(() => Array.from(document.querySelectorAll<HTMLLinkElement>(".chapter-list .row > span > a"), ({ href, innerText }) => ({
        url: href,
        title: innerText
    })));

async function getChapters(page: Page, manga: string): Promise<Chapter[]> {
    return page.goto(mangaUrl(manga))
        .then(() => getChapterLinks(page))
        .then(chapters => chapters.reverse());
}

function sliceChapters(chapters: Chapter[], chaptersNumber: number): Chapter[] {
    if (!chaptersNumber) return chapters;
    return chapters.slice(chaptersNumber < 0 ? chaptersNumber : 0, chaptersNumber >= 0 ? chaptersNumber : undefined);
}

function saveMangaToPdf(doc: typeof PDFDocument, page: Page, chapters: Chapter[]): Promise<void> {
    return chapters.reduce((chain, chapter) =>
        chain.then(() => addChapterToPdf(doc, page, chapter.url, chapter.title)),
        Promise.resolve()
    );
}

const getOutputPdfName = ({ chapters, manga }: CliArguments, chaptersCount: number) => {
    if (!manga) return "output.pdf";
    if (!chapters || chapters === 1) return `${manga}.pdf`;
    if (chapters > 1) return `${manga} (1 - ${chapters}).pdf`;
    return `${manga} (${chaptersCount + chapters} - ${chaptersCount}).pdf`;
};

export async function downloadManga({ chapters, manga = "tales_of_demons_and_gods" }: CliArguments) {
    const browser = await launch();
    const page = await browser.newPage();

    const mangaChapters = await getChapters(page, manga);
    // Create PDF file to render to
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(fs.createWriteStream(join(__dirname, getOutputPdfName({ manga, chapters }, mangaChapters.length))));

    await saveMangaToPdf(doc, page, sliceChapters(mangaChapters, chapters));

    doc.end();

    console.log("Done");
}
