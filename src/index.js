// @flow
//import "core-js/stable";
import "core-js/features/url";

class ChapterListItem {
    number: string;
    // Number is the chapter number. Could be an actual number like "1" or could
    // be a special chapter like "EX" or "Omake".
    //
    title: string;
    // Name is the short title of the chapter.
    // 
    description: string;
    // Description is the longer description of the chapter. May be blank
    // depending on the way the website handles information about chapters.
    // 
    identifier: string;
    // Identifier is a source-specific identifier. Could be an id like "1234" or
    // anything that makes sense for this source. This identifier will be
    // provided in getChapter call as chapterIdentifier to retrieve the chapter
    // pages.
    // 
    group: ?string
    // Optional: Scanalation group if one exists.
    // 
    variant: ?string
    // Optional: Set variant if there are multiple versions of the same chapter
    //           and group is not present or not enough to differintiate.
    //
    created: ?Date
    // Optional: Date created as a string if it exists.

    updated: ?Date
    // Optional: Date updated as a string if it exists.

    published: ?Date
    // Optional: Date of original chapter's publication as a string if it exists.

    constructor({
        number,
        identifier,
        title,
        description = "",
        group = null,
        variant = null,
        created = null,
        updated = null,
        published = null,
    }: {
        number: string,
        identifier: string,
        title: string,
        description?: string,
        group?: ?string,
        variant?: ?string,
        created?: ?Date,
        updated?: ?Date,
        published?: ?Date,
    }) {
        this.number = number;
        this.identifier = identifier;
        this.title = title;
        this.description = description;
        this.group = group;
        this.variant = variant;
        this.created = created;
        this.updated = updated;
        this.published = published;
    }
}

class ChapterList {
    chapters: Array<ChapterListItem>;
    // Chapters contains all the chapters for a given manga series.
    //

    constructor({ chapters }: { chapters: Array<ChapterListItem> }) {
        this.chapters = chapters;
    }
}


type PageDataHandler = (string) => (string);

class PageData {
    version: string = "1.0.0"
    highUrl: string
    lowUrl: ?string
    highHandler: ?PageDataHandler
    lowHandler: ?PageDataHandler

    constructor({
        highUrl,
        lowUrl = null,
        highHandler = null,
        lowHandler = null,
    }: {
        highUrl: string,
        lowUrl?: ?string,
        highHandler?: ?PageDataHandler,
        lowHandler?: ?PageDataHandler,
    }) {
        this.highUrl = highUrl;
        this.lowUrl = lowUrl;
        this.highHandler = highHandler;
        this.lowHandler = lowHandler;
    }
}

class ChapterData {
    version: string = "2.0.0"

    pages: Array<PageData>

    constructor({ pages }: { pages: Array<PageData> }) {
        this.pages = pages
    }
}

class MangaSeries {
    name: string;
    // Name is the name of the manga series.
    // 
    identifier: string;
    // Identifier is the id or unique identifier for this manga series on this
    // source.
    // 
    coverUrl: ?string;
    // NOTE: Optional
    // The coverUrl if one exists. Used to help users identify best matches.
    ranking: number;
    // NOTE: Optional
    // Ranking is the a representation of the likelyhood of this result being
    // the correct match. 0 being the best match and Number.MAX_SAFE_INTEGER
    // being the worst match. All negative numbers will be treated as equal.
    // 

    constructor({
        name,
        identifier,
        coverUrl = null,
        ranking = -1,
    }: {
        name: string,
        identifier: string,
        coverUrl?: ?string,
        ranking?: number,
    }) {
        this.name = name;
        this.identifier = identifier;
        this.coverUrl = coverUrl;
        this.ranking = ranking;
    }
}

class MangaSeriesList {
    results: Array<MangaSeries> = [];
    // Results is the list of all MangaSeries objects which match this query in
    // a searchManga call.

    constructor({ results = [] }: { results: Array<MangaSeries> }) {
        this.results = results;
    }
}

const BASE_URL = "https://api.mangadex.org";

export async function searchManga(
    seriesName: string,
    offset: number=0,
    limit: number=100
): Promise<MangaSeriesList> {
    limit = Math.min(limit, 100);
    console.debug("searchManga called.");
    let finalUrl = new URL(`${BASE_URL}/manga`);
    console.debug("Initialized url.", { url: finalUrl });
    let searchParams = new URLSearchParams({
        offset: offset,
        limit: limit,
        title: seriesName,
        "includes[]": "cover_art",
    });
    finalUrl.search = searchParams.toString();
    console.debug("Added search params.", { url: finalUrl });

    let response = await fetch(finalUrl);
    let json = await response.json();

    console.debug("Received response.", { response });
    
    let results = json.data.map((result, i) => {
        const id = result.id;

        let title = result.attributes.title.en;
        if (!title) {
            title = result.attributes.title.jp;
        }
        if (!title) {
            console.log(
                "Couldn't determine proper title.",
                { raw_data: result }
            )
            return null;
        }

        const coverArts = result.relationships.filter(rel => (
            rel.type === "cover_art"
        ));

        let coverUrl = null;
        if (coverArts.length > 0) {
            const coverFilename = coverArts.shift().attributes.fileName;
            coverUrl = `https://uploads.mangadex.org/covers/${id}/${coverFilename}.512.jpg`;
        }

        return new MangaSeries({
            name: title,
            identifier: id,
            coverUrl: coverUrl,
            ranking: i,
        })
    }).filter(x => x);

    return new MangaSeriesList({
        results: results,
    });
}

export async function listChapters(
    seriesIdentifier: string,
    offset: number=0,
    limit: number=100,
    since: ?Date=null,
    order: string="asc"
): Promise<ChapterList> {
    console.debug("listChapters called.", {
        seriesIdentifier,
        offset,
        limit,
        since,
        order,
    })

    const languages = ["en"];

    let finalUrl = new URL(`https://api.mangadex.org/manga/${seriesIdentifier}/feed`);
    let searchParams = new URLSearchParams({
        "translatedLanguage[]": languages,
        offset: offset,
        limit: limit,
        "order[chapter]": order,
        "includes[]": "scanlation_group",
        includeEmptyPages: 0,
        includeFuturePublishAt: 0,
        includeExternalUrl: 0,
    });
    if (since) {
        const formattedSince = since.toISOString().split(".")[0];
        searchParams.set("updatedAtSince", formattedSince);
    }
    finalUrl.search = searchParams.toString();

    console.debug("Search params for initial call", { params: searchParams.toString() });

    let response = await fetch(finalUrl);
    let chapJson = await response.json();

    if(chapJson.data.length == 0) {
        console.log("No new chapters found for series.", { id: seriesIdentifier });
        return new ChapterList({
            chapters: [],
        })
    }

    finalUrl = new URL(`${BASE_URL}/manga/${seriesIdentifier}/aggregate`);
    searchParams = new URLSearchParams({
        "translatedLanguage[]": languages,
    });
    console.debug("Search params for final call.", { params: searchParams.toString() });
    finalUrl.search = searchParams.toString();

    response = await fetch(finalUrl);
    let json = await response.json();

    let idAbsoluteChapterNumbers = {};
    console.log(`volumes: ${JSON.stringify(json.volumes)}`);
    const volume2 = json.volumes["2"];
    console.log(`volume 2: ${JSON.stringify(volume2)}`);
    if (volume2) {
        const chapNums = Object.keys(volume2.chapters).map(x => parseInt(x)).filter(x => x && !x.isNaN);
        const minChap = Math.min(...chapNums);

        console.log(`chapNums: ${JSON.stringify(chapNums)}`);
        console.log(`minChap: ${minChap}`);
        if (minChap <= 1) {
            idAbsoluteChapterNumbers = await normalizeChapterNumbers(json);
        }
    }

    console.log("Absolute chapter numbers (main).", { chapNumbers: idAbsoluteChapterNumbers });

    const chapters = await Promise.all(chapJson.data.map(async result => {
        const id = result.id;
        const {
            title,
            chapter,
            createdAt,
            updatedAt,
            publishAt
        } = result.attributes;
        const groupRelationship = result.relationships.filter(rel => (
            rel.type === "scanlation_group"
        ));
        let groupName = null;
        if (groupRelationship.length > 0) {
            groupName = groupRelationship.shift().attributes.name
        }

        let number = idAbsoluteChapterNumbers[id];
        console.log("Looked up absolute number.", { number: number, id: id });
        if (!number) {
            number = chapter;
        }
        let chapItem = new ChapterListItem({
            identifier: id,
            title: title,
            number: number,
            group: groupName,
            created: createdAt,
            updated: updatedAt,
            published: publishAt,
        });
        console.debug("Creating final ChapterListItem", chapItem);
        return chapItem;
    }));

    console.debug("Creating final chapter list.", { chapters });
    const chapList = new ChapterList({
        chapters: chapters,
    });

    return chapList;
}

export async function getChapter(chapterIdentifier: string): Promise<ChapterData> {
    const url = `${BASE_URL}/at-home/server/${chapterIdentifier}?forcePort443=true`
    console.debug(`Chapter URL: ${url}`);
    let response = await fetch(url);
    if(!response.ok) {
        let respText = ""
        try {
            respText = await response.text;
        } catch (err) {
            console.error("Failed to read error response from request.", err);
        }

        throw new Error(`Bad response from server: ${response.status} - ${response.statusText}\n${respText}`);
    }

    let json = await response.json();
    const { baseUrl, chapter } = json;
    const { data: highURLs, "dataSaver": lowURLs, hash } = chapter;
    let pages = highURLs.map((high, i) => (
        new PageData({
            highUrl: `${baseUrl}/data/${hash}/${high}`,
            lowUrl: `${baseUrl}/data-saver/${hash}/${lowURLs[i]}`,
        })
    ))
    return new ChapterData({ pages });
}
