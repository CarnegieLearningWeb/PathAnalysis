import './App.css';
import {useContext, useEffect, useState} from 'react';
import {GlobalDataType, GraphData} from './lib/types';
import DropZone from './components/DropZone';

import {Button} from './components/ui/button';
import {Context} from './Context';
import {processDataShopData} from './lib/dataProcessingUtils';
import Loading from './components/Loading';

function App() {

    const {resetData, setGraphData, setLoading, data, setData, loading, error, setError} = useContext(Context);
    const [showDropZone, setShowDropZone] = useState<boolean>(true);
    const handleData = (data: GlobalDataType[]) => {
        setData(data)
        setShowDropZone(false)
    }

    const handleLoading = (loading: boolean) => {
        setLoading(loading)
    }

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
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
                {error && (
                    <div className="text-red-500 p-4 m-4 bg-red-50 rounded-md">
                        {error.split('\n').map((errorLine, index) => (
                            <p key={index} className="mb-1">{errorLine}</p>
                        ))}
                    </div>
                )}
                <div className=" flex items-center justify-center pt-20">
                    {
                        loading ?
                            <Loading/>
                            :
                            (
                                showDropZone && (
                                    <div className="">
                                        <DropZone afterDrop={handleData} onLoadingChange={handleLoading}
                                                  onError={handleError}/>
                                    </div>
                                )

                            )

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
