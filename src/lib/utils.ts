import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {GlobalDataType} from "./types"
import Papa from "papaparse"
// import Joi from "joi"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// const validation = Joi.array().items(
//   Joi.object({
//     'Time': Joi.string().required(),
//     'Step Name': Joi.string().default('DoneButton').required(),
//     'Outcome': Joi.string().valid('OK', 'BUG', 'INITIAL_HINT', 'HINT_LEVEL_CHANGE', 'ERROR').required(),
//     'CF (Workspace Progress Status)': Joi.string().required(),
//     'Problem Name': Joi.string().required(),
//     'Anon Student Id': Joi.string().required()
//   }).unknown()
// );

export function parseData(readerResult: string | ArrayBuffer | null, delimiter: string = ","): GlobalDataType[] | null {
    if (!readerResult || typeof readerResult !== 'string') {
        return null;
    }

    try {
        // For JSON files
        if (delimiter === '') {
            try {
                const jsonData = JSON.parse(readerResult);
                return Array.isArray(jsonData) ? jsonData : null;
            } catch (e) {
                console.error('JSON parsing failed:', e);
                return null;
            }
        }

        // For CSV/TSV files
        const parseResult = Papa.parse(readerResult, {
            header: true,
            delimiter: delimiter,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            quoteChar: '"',        // Specify quote character
            escapeChar: '"',       // Specify escape character
            dynamicTyping: true,   // Automatically convert strings to numbers where appropriate
        });

        if (parseResult.errors.length > 0) {
            console.error('Parsing errors:', parseResult.errors);
            return null;
        }

        // Validate that we have the expected columns
        const firstRow = parseResult.data[0];
        if (!firstRow || typeof firstRow === 'string' || Array.isArray(firstRow)) {
            console.error('Invalid data format');
            return null;
        }
        console.log('First row:', firstRow);
        console.log('Data:', parseResult.data);


        return parseResult.data as GlobalDataType[];
    } catch (error) {
        console.error('Error parsing data:', error);
        return null;
    }
}