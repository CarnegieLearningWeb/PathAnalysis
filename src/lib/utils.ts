import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {GlobalDataType} from "./types"
import Papa from "papaparse"
import Joi from "joi"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const dataSchema = Joi.array().items(
    Joi.object({
        'Time': Joi.alternatives().try(
            Joi.string(),
            Joi.number()
        ).required(),
        'Step Name': Joi.string().required(),
        'Outcome': Joi.string().required(),
        'CF (Workspace Progress Status)': Joi.string().required(),
        'Problem Name': Joi.string().required(),
        'Anon Student Id': Joi.string().required()
    })
        .unknown(true)
);

export function parseData(readerResult: string | ArrayBuffer | null, delimiter: string = ","): GlobalDataType[] | null {
    if (!readerResult || typeof readerResult !== 'string') {
        return null;
    }

    try {
        // Handle JSON files
        if (delimiter === '') {
            try {
                const jsonData = JSON.parse(readerResult);
                const {error, value} = dataSchema.validate(jsonData);
                if (error) {
                    console.error('Validation error:', error.details);
                    return null;
                }
                return value;
            } catch (e) {
                console.error('JSON parsing failed:', e);
                return null;
            }
        }

        // Handle CSV/TSV files
        const parseResult = Papa.parse(readerResult, {
            header: true,
            delimiter: delimiter,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            quoteChar: '"',
            escapeChar: '"',
            dynamicTyping: true,
        });

        if (parseResult.errors.length > 0) {
            console.error('Parsing errors:', parseResult.errors);
            return null;
        }

        // Validate the parsed data
        const {error, value} = dataSchema.validate(parseResult.data);
        if (error) {
            console.error('Validation error:', error.details);
            return null;
        }

        return value;
    } catch (error) {
        console.error('Error parsing data:', error);
        return null;
    }
}