import './App.css';
import {useContext, useEffect, useState} from 'react';
import {GlobalDataType, GraphData} from './lib/types';
// import DirectedGraph from './components/DirectedGraph';
import DropZone from './components/DropZone';
// import { NavBar } from './components/NavBar';

import {Button} from './components/ui/button';
import {Context} from './Context';
import {processDataShopData} from './lib/dataProcessingUtils';
import Loading from './components/Loading';

function App() {

    const {resetData, setGraphData, setLoading, data, setData, loading} = useContext(Context)
    const [showDropZone, setShowDropZone] = useState<boolean>(true)
    const handleData = (data: GlobalDataType[]) => {
        setData(data)
        setShowDropZone(false)
    }

    const handleLoading = (loading: boolean) => {
        setLoading(loading)
    }

    useEffect(() => {
        if (data) {
            const graphData: GraphData = processDataShopData(data)
            setGraphData(graphData)

        }
    }, [data])

    return (
        <>
            <div className="">
                {/* <NavBar /> */}
                <Button
                    className="m-2"
                    variant={"ghost"}
                    onClick={() => {
                        resetData()
                        setShowDropZone(true)
                    }}
                >
                    Reset
                </Button>

                <div className=" flex items-center justify-center pt-20">
                    {
                        loading ?
                            <Loading/>
                            :
                            (
                                showDropZone && (
                                    <div className="">
                                        <DropZone afterDrop={handleData} onLoadingChange={handleLoading}/>
                                    </div>
                                )

                            )

                    }

                    {
                        data && <div>
                                <h1 className="text-2xl font-bold">Uploaded Data</h1>
                                <pre>{JSON.stringify(data, null, 2)}</pre>
                            </div>
                    }
                    {/*{*/}
                    {/*    graphData && (*/}
                    {/*        <>*/}
                    {/*            /!* TODO: Swap DirectedGraph for your new component *!/*/}
                    {/*            <DirectedGraph graphData={graphData}/>*/}
                    {/*        </>*/}
                    {/*    )*/}
                    {/*}*/}

                </div>
            </div>
        </>
    )
}

export default App
