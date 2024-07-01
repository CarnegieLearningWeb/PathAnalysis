import './App.css';
import {useContext, useEffect, useState} from 'react';
import { GlobalDataType, GraphData } from './lib/types';
import DirectedGraph from './components/DirectedGraph';
import DropZone from './components/DropZone';
// import { NavBar } from './components/NavBar';
import { Button } from './components/ui/button';
import { Context } from './Context';
import { processDataShopData } from './lib/dataProcessingUtils';
import {filterPromGrad} from "@/lib/GradPromUtils";
import Switch from "@/components/ui/switch.tsx";
import './Switch.css';


function App() {

  const { resetData, setGraphData, setLoading, setFilteredData, filteredData,
      data, setData, graphData, loading } = useContext(Context)
  const [showDropZone, setShowDropZone] = useState<boolean>(true)

  const handleData = (data: GlobalDataType[]) => {
    setData(data)
    setShowDropZone(false)
  }

  const handleLoading = (loading: boolean) => {
    setLoading(loading)
  }

  const filterData = (data: GlobalDataType[], filter:"PROMOTED"|"GRADUATED"|null|string) => {
      if (data){
        const f = filterPromGrad(data, filter)
        // setFilteredData(f)
        return f
      }
      else {

      }
    // console.log(data)
    // return filteredData
  }

  // const handleFilteredData = (filteredData: GlobalDataType[]) => {
  //     setData(filteredData)
  //     setShowDropZone(false)
  //     const graphData: GraphData = processDataShopData(filteredData)
  //     setGraphData(graphData)
  // }

  useEffect(() => {
    if (data) {
      const graphData: GraphData = processDataShopData(data)
      setGraphData(graphData)
    }}, [data])

  useEffect(() => {
    if (filteredData) {
      const graphData: GraphData = processDataShopData(filteredData)
      setGraphData(graphData)
    }}, [filteredData])

  const [isOn, setIsOn] = useState(false);
  const [isSwitchEnabled, setIsSwitchEnabled] = useState(false);
  const [filter, setFilter] = useState<"PROMOTED"|"GRADUATED"|null|string>("GRADUATED");
  // Using Graduated as initial gives the first click the correct value but not after
  // -- doesn't work if initial state is null

  const handleToggle = () => {
    if (isSwitchEnabled){
      setIsOn(!isOn);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsSwitchEnabled(event.target.checked);
  };

  // const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   setFilter(event.target.value);
  //   };

  useEffect(() => {
      if (isSwitchEnabled) {
          let value = isOn ? "PROMOTED" : "GRADUATED";
          setFilter(value);
          // console.log("Filter: " + filter)
          let f = filterData(data!, value) // Why can't I use filter here instead of value?

          console.log("Filter: " + value)

          console.log(f)
      }

      else{
          setData(data!)
          console.log(data)
      }


  }, [isSwitchEnabled, isOn]);

  const getValueBasedOnSwitch = () => {
    if (isSwitchEnabled) {
        return filter
    };
  }

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
                      <div
                          className="absolute top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
                          <div className="bg-white p-4 rounded-lg">
                              <p>Loading...</p>
                          </div>
                      </div>
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
                  graphData && (
                      <>
                          {/* Add suspense, lazy? */}
                          <DirectedGraph graphData={graphData}/>
                      </>
                  )
              }


              {/*<div className="checkbox">*/}
              {/*    <label>*/}

              {/*        <input type="checkbox" checked={isSwitchEnabled} onChange={handleCheckboxChange}/>*/}
              {/*        <span class="tab"></span>Filter by Section Completion Status?*/}
              {/*    </label>*/}
              {/*    <Switch isOn={isOn} handleToggle={handleToggle} filter={filter}*/}
              {/*            isDisabled={!isSwitchEnabled}*/}
              {/*        // onChange={handleFilterChange}*/}
              {/*    />*/}
              {/*    <br></br>*/}
              {/*    <br></br>*/}
              {/*    <br></br>*/}

              {/*    <label>Status: {getValueBasedOnSwitch()}</label>*/}
              {/*</div>*/}

          </div>
      </div>

</>
)
}

export default App
