// Import Comlink from CDN or local source
// import {GlobalDataType} from "@/lib/types.ts";
// import * as Comlink from 'comlink';
// importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');

// Define the data processing logic
// function parseData(text: string, delimiter: string): string[][] | null {
//     // Example parsing logic
//     // Split the text into lines, then split each line into columns based on the delimiter
//     const lines = text.split('\n');
//     return lines.map(line => line.split(delimiter)).filter(parts => parts.length > 0);
// }
//
// // Define the API that will be exposed to the main thread
// interface WorkerApi {
//     parseData(text: string, delimiter: string): Promise<GlobalDataType[] | null>;
// }

// Create an object that implements the WorkerApi interface
// const api: WorkerApi = {
//     parseData: (text, delimiter) => Promise.resolve(parseData(text, delimiter))
// };
//
// // Expose the API to the main thread using Comlink
// Comlink.expose(api);