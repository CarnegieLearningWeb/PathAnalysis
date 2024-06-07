import { IncomingData, Node, Link, GraphData, LinkObject, NodeObject, IncomingDataRaw, GlobalDataType } from "@/lib/types";
import _ from 'lodash';

// ----------------- DATA PROCESSING UTILS DataShop Data -----------------

const END_NODE = 'END';

export function processDataShopData(data: GlobalDataType[]): GraphData{
    /*
        ---- ABOUT ----
        This function processes the data from the Mathia Course 2 dataset.
        The nodes would be the point in a students path through Mathia.
        The links would connect the nodes and represent the transitions between the nodes.
        The width of the links would represent the number of transitions between the nodes.
        The rank of the nodes represents the average step order of the nodes. 
        The color of the links would represent the correctness of the transition.

        ----- NOTES -----
        The data is already sorted by Time **within each anon student id** so we can use this to calculate both the rank and the next node in the sequence.
        The data has a problem name and then each step name ordered sequentially. The graph terminates when the step name is `null` and Selection = 'Done Button'
        So we can filter the data by Problem Name and then group by student in order to contstruct the paths. Then we overlay all of them to get the full graph.
        We can count the instances of each transition to get the width of the links.

        Right now, the sample data is from one specific problem, so the eventual API will have to fetch data based on the problem name rather than getting the whole dataset

    */

    if (data.length === 0) {
        return { nodes: [], links: [] };
    }

    // first, create the nodes

    const nodes = new Map<string, Node>();
    const links = new Map<string, Link>();
    const transitions = new Map<string, number>();

    // first pass: calculate node info and transitions
    for (let i = 0; i < data.length; i++) {
        const currRow = data[i];
        const nodeId = `${currRow['Problem Name']}-${currRow['Step Name']}`;
        if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
                id: nodeId,
                label: nodeId,
                rank: 0, // init rank but calc later
                times_errored: 0, // same
                problemId: currRow['Problem Name'],
            });
        }

        // calc times_errored as we go
        if (currRow['Outcome'] === 'ERROR') {
            const node = nodes.get(nodeId);
            // by this point it will have times_errored so no need to check
            node!.times_errored! += 1;
        }

        // figure out next step the student went to
        const nextNodeId: string | null = data[i + 1] ? `${data[i + 1]['Problem Name']}-${data[i + 1]['Step Name']}` : null;

        // create the link
        if (nextNodeId) {
            const linkId = `${nodeId}-${nextNodeId}`;
            if (!links.has(linkId)) {
                links.set(linkId, {
                    source: nodeId,
                    target: nextNodeId,
                    width: 1,
                    numOfTransitions: 1,
                    curvature: nodeId === nextNodeId ? 2 : 0.1,
                    color: currRow['Outcome'] === 'OK' ? 'green' : 'red',
                });
            } else {
                // build width of links before normalization
                const link = links.get(linkId);
                link!.width += 1;
                link!.numOfTransitions += 1;
            }
        }
        const transitionKey = `${nodeId}=>${nextNodeId ?? END_NODE}`;
        transitions.set(transitionKey, (transitions.get(transitionKey) || 0) + 1);
    }

    // calculate max edge count for normalization
    const maxEdgeCount = Math.max(...Array.from(transitions.values()));

    // calculate width of links
    for (const link of Array.from(links.values())) {
        const transitionKey = `${link.source}=>${link.target}`;
        const transitionCount = transitions.get(transitionKey) || 1;
        const normalizedTransitionCount = ((transitionCount / maxEdgeCount) * 10) + 1;
        link.width = normalizedTransitionCount;
    }

    // calculate pathsOut and pathsIn for nodeInfo
    const pathsOutCounts = new Map<string, number>();
    const pathsInCounts = new Map<string, number>();
    const selfLoopCounts = new Map<string, number>();
    const cumulativePathsOutCounts = new Map<string, number>();
    const cumulativePathsInCounts = new Map<string, number>();
    const cumulativeSelfLoopCounts = new Map<string, number>();
    for (const link of Array.from(links.values())) {
        pathsOutCounts.set(link.source, (pathsOutCounts.get(link.source) || 0) + 1);
        pathsInCounts.set(link.target, (pathsInCounts.get(link.target) || 0) + 1);
        cumulativePathsOutCounts.set(link.source, (cumulativePathsOutCounts.get(link.source) || 0) + link.numOfTransitions);
        cumulativePathsInCounts.set(link.target, (cumulativePathsInCounts.get(link.target) || 0) + link.numOfTransitions);
        // calculate self loops
        selfLoopCounts.set(link.source, (selfLoopCounts.get(link.source) || 0) + 1);
        

    }
    for (const node of Array.from(nodes.values())) {
        node.edgesOut = pathsOutCounts.get(node.id) || 0;
        node.edgesIn = pathsInCounts.get(node.id) || 0;
        // calculate self loops
        selfLoopCounts.set(node.id, (selfLoopCounts.get(node.id) || 0) + 1);
        node.selfLoops = selfLoopCounts.get(node.id) || 0;

        // calculate cumulative paths
        node.cumulativeEdgesOut = cumulativePathsOutCounts.get(node.id) || 0;
        node.cumulativeEdgesIn = cumulativePathsInCounts.get(node.id) || 0;
        node.cumulativeSelfLoops = cumulativeSelfLoopCounts.get(node.id) || 0;
    }

 

    return {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values()),
        maxEdgeCount,
    };
}
// ----------------- DATA PROCESSING UTILS Athena Data -----------------


function createNodeLabel(str: string): string {
    const words = str.split("-");
    const uniqueWords = _.uniq(words);
    // cut down to 3 words
    if (uniqueWords.length > 3) {
        uniqueWords.length = 3;
    }
    return uniqueWords.join(" ") + "...";
}

function generateKey(obj: IncomingData): string {
    return obj.tutor_goalnode_id + "-" + obj.next_tutor_goalnode_id;
}

export function changeLinkThreshold(data: LinkObject[], threshold: number): LinkObject[] {
    if (threshold === 0) {
        return data;
    }
    return data.filter((link: LinkObject) => link.numOfTransitions >= threshold);
}

export function removeUnusedNodes(nodes: Node[] | NodeObject<Node>[], links: LinkObject[]): { newNodes: Node[] | NodeObject<Node>[], removedNodes: Node[] | NodeObject<Node>[] } {
    // remove nodes with no connecting links
    // at this point link.source and link.target are Node objects

    const nodeIds = new Set(links.map(link => link.source.id).concat(links.map(link => link.target.id)));
    const removedNodes = nodes.filter(node => !nodeIds.has(node.id));
    const newNodes = nodes.filter(node => nodeIds.has(node.id));
    return { newNodes, removedNodes };
}

export function addUnusedNodes(nodes: Node[], links: LinkObject[]): Node[] {
    const nodeIds = new Set(nodes.map(node => node.id));
    const addedNodes = links.filter(link => !nodeIds.has(link.source.id)).map(link => link.source);
    const newNodes: Node[] = nodes.concat(addedNodes);
    return newNodes;
}

export function removeUnusedLinks(nodes: Node[], links: LinkObject[]) {
    const nodeIds = new Set(nodes.map(node => node.id));
    const oldLinks = links;
    const newLinks = links.filter(link => nodeIds.has(link.source.id) && nodeIds.has(link.target.id));
    return { oldLinks, newLinks };
}


// MAIN PROCESSING FUNCTION
export async function processPathAnalysisData(data: IncomingData[], ignoreSelfLoops = false): Promise<GraphData> {
    // runtime of this function is O(n) where n is the number of rows in the data. The constants may be significant though.
    const nodes = new Map<string, Node>();
    const transitionCounts = new Map<string, number>();
    const links = new Map<string, LinkObject>();
    const pathsOutCounts = new Map<string, number>();
    const pathsInCounts = new Map<string, number>();
    const rankAverageMap = new Map<string, number>();
    const rankSums = new Map<string, number>();
    const rankCounts = new Map<string, number>();

    if (data.length === 0) {
        return { nodes: [], links: [] };
    }

    // sum and count average current_step count
    for (const d of data) {
        if (d.current_step) {
            // Update the sum for this tutor_goalnode_id
            rankSums.set(d.tutor_goalnode_id, (rankSums.get(d.tutor_goalnode_id) || 0) + d.current_step);
            // Update the count for this tutor_goalnode_id
            rankCounts.set(d.tutor_goalnode_id, (rankCounts.get(d.tutor_goalnode_id) || 0) + 1);
        }
    }

    // calculate weighted average
    for (const [key, sum] of Array.from(rankSums.entries())) {
        const count = rankCounts.get(key) || 1; // Avoid division by zero
        rankAverageMap.set(key, sum / count);
    }

    // first pass: count the number of transitions between nodes for width
    for (const d of data) {
        const transitionKey = generateKey(d);
        transitionCounts.set(transitionKey, (transitionCounts.get(transitionKey) || 0) + 1);
    }
    const maxTransitionCount = Math.max(...Array.from(transitionCounts.values()));

    // second pass: create nodes and links
    for (const d of data) {
        // Create or retrieve source node
        let label = createNodeLabel(d.tutor_goalnode_id);
        // this gets rid of header node data
        if (!d.tutor_goalnode_id.includes("tutor_goalnode_id")) {
            if (!nodes.has(d.tutor_goalnode_id)) {
                nodes.set(d.tutor_goalnode_id, {
                    id: d.tutor_goalnode_id,
                    label: label,
                    rank: rankAverageMap.get(d.tutor_goalnode_id) || 0,
                    problemId: d.problem_id,
                });
            }

            // If next_tutor_goalnode_id is not null and not a self-loop, create target node and link
            if (d.next_tutor_goalnode_id !== undefined && (!ignoreSelfLoops || d.tutor_goalnode_id !== d.next_tutor_goalnode_id)) {
                label = createNodeLabel(d.next_tutor_goalnode_id ?? label);
                if (!nodes.has(d.next_tutor_goalnode_id)) {
                    nodes.set(d.next_tutor_goalnode_id, {
                        id: d.next_tutor_goalnode_id,
                        label: label,
                        rank: rankAverageMap.get(d.next_tutor_goalnode_id) || 0,
                        problemId: d.problem_id,
                    });
                }

                const linkKey = generateKey(d);
                const transitionCount = transitionCounts.get(linkKey) || 1;
                const normalizedTransitionCount = ((transitionCount / maxTransitionCount) * 10) + 1;
                if (!links.has(linkKey)) {

                    links.set(linkKey, {
                        source: nodes.get(d.tutor_goalnode_id)!,
                        target: nodes.get(d.next_tutor_goalnode_id)!,
                        width: normalizedTransitionCount,
                        numOfTransitions: transitionCount,
                        curvature: (d.tutor_goalnode_id === d.next_tutor_goalnode_id ? 2 : 0.1), // self-loops have a higher curvature
                        color: d.evaluation === "CORRECT" ? "green" : "red",
                    });


                }
            }
        }
    }

    // links pass: count the number of paths in and out of each node
    // to fix typescript error, try below:
    //     for (const link of Array.from(links.values())) {

    for (const link of Array.from(links.values())) {
        pathsOutCounts.set(link.source.id, (pathsOutCounts.get(link.source.id) || 0) + 1);
        pathsInCounts.set(link.target.id, (pathsInCounts.get(link.target.id) || 0) + 1);
    }

    // nodes pass: Assign pathsIn and pathsOut to nodes
    for (const node of Array.from(nodes.values())) {
        node.edgesOut = pathsOutCounts.get(node.id) || 0;
        node.edgesIn = pathsInCounts.get(node.id) || 0;
    }

    // check for nodes with no id
    for (const node of Array.from(nodes.values())) {
        if (!node.id) {
            console.log("node without id: ", node);
        }
    }

    // assign times errored
    for (const d of data) {
        if (d.evaluation === "ERROR") {
            nodes.get(d.tutor_goalnode_id)!.times_errored = (nodes.get(d.tutor_goalnode_id)!.times_errored || 0) + 1;
        }
    }

    const finalData: GraphData = {
        nodes: Array.from(nodes.values()),
        links: Array.from(links.values()),
    };

    // finalData = addShapesToNodes(finalData);
    // console.log("final data: ", finalData);
    finalData.maxEdgeCount = maxTransitionCount;


    return finalData;
}

export function removeErrorLinksAndStore(links: LinkObject[]): { withoutErrors: LinkObject[], errorLinks: LinkObject[] } {
    const errorLinks = links.filter(link => link.color === "red");
    const withoutErrors = links.filter(link => link.color !== "red");
    return { withoutErrors, errorLinks };
}

export function removeSolverNodes(nodes: Node[]): { withoutSolver: Node[], solverNodes: Node[] } {
    // first, check if an `aux` node exists
    const auxNodes: Node[] = nodes.filter(node => node.id.includes("aux"));
    if (auxNodes.length === 0) {
        return { withoutSolver: nodes, solverNodes: [] };
    }
    else {
        // color aux nodes
        for (const node of auxNodes) {
            node.color = 'orange'
        }

    }

    // if the id contains `solver` then remove it
    const solverNodes: Node[] = nodes.filter(node => node.id.includes("solver"));
    const withoutSolver: Node[] = nodes.filter(node => {
        if (!node.id.includes("solver") || node.id.includes("aux")) {
            return true;
        }
        else {
            return false;
        }
    });
    // color aux node
    return { withoutSolver, solverNodes };


}

export function convertDataTypesIncomingData(data: IncomingDataRaw[]): IncomingData[] {
    return data.map(data => ({
        section_id: data.section_id,
        problem_id: data.problem_id,
        ct_context_id: data.ct_context_id,
        tutor_goalnode_id: data.tutor_goalnode_id,
        next_tutor_goalnode_id: data.next_tutor_goalnode_id ?? undefined,
        current_step: parseInt(data.current_step),
        max_step: parseInt(data.max_step),
        evaluation: data.evaluation,
        input: data.input,
        attempt: parseInt(data.attempt),
        is_autofil: data.is_autofil === "true",
        current_time: parseInt(data.current_time),
        total_time: parseInt(data.total_time)
    }));

}