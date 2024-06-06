export type GlobalDataType = DataSet1 & IncomingMathiaCourse2Data;

export type DataSet1 = {
    Row: number;
    "Sample Name": "All Data" | string;
    "Transaction Id": string;
    "Anon Student Id": string;
    "Session Id": "no_session_tracking";
    Time: string; // Assume data is sorted by time
    "Time Zone": boolean | null;
    "Duration (sec)": number | null;
    "Student Response Type": boolean | null;
    "Student Response Subtype": boolean | null;
    "Tutor Response Type": boolean | null;
    "Tutor Response Subtype": boolean | null;
    "Level (Workspace Id)": string;
    "Problem Name": string;
    "Problem View": number;
    "Problem Start Time": string;
    "Step Name": string | null;
    "Attempt At Step": number;
    "Is Last Attempt": boolean | null;
    Outcome: "OK" | "BUG" | "INITIAL_HINT" | "HINT_LEVEL_CHANGE" | "ERROR";
    Selection: "Done Button" | null;
    Action: "Attempt" | "Done" | "Hint Request" | "Hint Level Change";
    Input: string | null;
    "Feedback Text": boolean | null;
    "Feedback Classification": boolean | null;
    "Help Level": number;
    "Total Num Hints": boolean | null;
    "KC (MATHia)": string | null;
    "KC Category (MATHia)": boolean | null;  
    "KC (Single-KC)": string | null;
    "KC Category (Single-KC)": boolean | null;
    "KC (Unique-step)": string | null;
    "KC Category (Unique-step)": boolean | null;
    School: boolean | null;
    Class: boolean | null;
    "CF (Etalon)": string | null;
    "CF (Ruleid)": string | null;
    "CF (Semantic Event Id)": string;
    "CF (Skill New p-Known)": number | null;
    "CF (Skill Previous p-Known)": number | null;
    "CF (Workspace Progress Status)": "GRADUATED" | "PROMOTED" | "NOT_COMPLETED";
    "Event Type": boolean | null;
}

export type IncomingMathiaCourse2Data = {
    // incoming data will all be strings so we would need to convert them to the appropriate types
    "Anon Student Id": string;
    "Session Id": "no_session_tracking";
    "Time": number;
    "Level (Workspace Id)": string;
    "Problem Name": string;
    "Step Name": string | null;
    "Selection": "Done Button" | null;
    "Action": "Attempt" | "Hint Level Change" | "Hint Request" | "Done";
    "Input": string | null;
    "Outcome": "OK" | "HINT_LEVEL_CHANGE" | "ERROR" | "BUG" | "INITIAL_HINT";
    "Help Level": number;
    "Attempt At Step": number;
    "KC Model(MATHia)": string | null;
    "CF (Ruleid)": string | null;
    "CF (Etalon)": string | null;
    "CF (Skill Previous p-Known)": number | null;
    "CF (Skill New p-Known)": number | null;
    "CF (Workspace Progress Status)": "GRADUATED" | "PROMOTED" | "NOT_COMPLETED";
    "CF (Semantic Event Id)": string;
}

export type IncomingDataRaw = {
    section_id: string;
    problem_id: string;
    ct_context_id: string;
    tutor_goalnode_id: string;
    next_tutor_goalnode_id: string | null;
    current_step: string;
    max_step: string;
    evaluation: "CORRECT" | "ERROR"
    input: string;
    attempt: string;
    is_autofil: string;
    current_time: string;
    total_time: string;
}

export type IncomingData = {
    /*
        Notes:
            Constructing a directed graph from this data:
                - each node represents a unique `tutor_goalnode_id`
                - each directed edge connects to a `next_tutor`goalnode_id`
            Weights would have to be calculated based on how common each transition is. How many times does each transition occur in the dataset?


    */
    section_id: string;
    problem_id: string;
    ct_context_id: string;
    tutor_goalnode_id: string;
    next_tutor_goalnode_id: string | undefined;
    current_step: number;
    max_step: number;
    evaluation: "CORRECT" | "ERROR"
    input: string;
    attempt: number;
    is_autofil: boolean;
    current_time: number;
    total_time: number;
}

export enum ShapeTypes {
    Circle = 'circle',
    Square = 'square',
    Triangle = 'triangle',
    Diamond = 'diamond',
    Star = 'star',
}

export type Node = {
    id: string;
    label: string;
    rank?: number;
    times_errored?: number;
    color?: string;
    border?: boolean;
    x?: number;
    y?: number;
    fx?: number | undefined;
    fy?: number | undefined;
    goalNodeId?: string;
    selfLoops?: number;
    shape?: string;
    problemId?: string;
    edgesIn?: number;
    edgesOut?: number;
    cumulativeEdgesIn?: number;
    cumulativeEdgesOut?: number;
    cumulativeSelfLoops?: number;
    radius?: number;
}


export type Link = {
    // pre processing by component -- component returns it as LinkObjkect
    source: string;
    target: string;
    width: number;
    numOfTransitions: number;
    label?: string;
    color?: string;
    curvature?: number | null;
}

export type LinkObject = {
    source: Node;
    target: Node;
    width: number;
    numOfTransitions: number;
    label?: string;
    color?: string;
    curvature?: number | null;
}

export type GraphData = {
    nodes: Node[] | NodeObject<Node>[];
    links: Link[] | LinkObject[];
    maxEdgeCount?: number;
}

export type ToolTip = {
    display: boolean;
    text: string;
    x: number;
    y: number;
    fx: number | undefined;
    fy: number | undefined;
}

export type NodeObject<T> = T & {
    x: number;
    y: number;
    index: number;
    vy: number;
    vx: number;
    fx: number | null;
    fy: number | null;
};


export type ContextMenuControls = {
    visible: boolean;
    x: number;
    y: number;
    node: Node | null;
}

export type DropdownOption = {
    label: string;
    value: string;
}

export type StudentPath = {
    paths: string[];
    currentStep: number;
    problemId?: string;
    sectionId?: string;
}