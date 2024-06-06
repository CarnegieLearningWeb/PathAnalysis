import { createContext, useState } from 'react';
interface ContextInterface {

}
export const Context = createContext({} as ContextInterface);

const initialState = {

}

interface ProviderProps {
    children: React.ReactNode;
}
export const Provider = ({ children }: ProviderProps) => {
    return (
        <Context.Provider
            value={{}}
        >
            {children}
        </Context.Provider>
    )
}