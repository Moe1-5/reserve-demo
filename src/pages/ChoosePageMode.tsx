import{demoStore} from "../lib/demoStore" 
import { useNavigate, useParams } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"


function ChoosePageMode() {
const mode = useStore(demoStore, (state) => state.mode);
const navigate = useNavigate();
const params = useParams({strict: false});
const isAdmin = mode === "admin"; 

const handlePageSelect = (isPageSelected: boolean) => {

    if(isAdmin){
    if (isPageSelected) {
        navigate({to:"/admin/panel"})
    } else {
        navigate({to:"/admin/reservations"}) 
    };
    }else if(mode === "client"){
        const clientId = params.clientId || "";
        if (isPageSelected) {
        navigate({to:`/client/$clientId/panel`, params: {clientId}})
    } else {
        navigate({to:`/client/$clientId/reservations`, params: {clientId}}) 
    };
    } else return;
    }; 

    return (
        <div className="-mx-4 flex h-full min-h-[560px] flex-1 flex-col items-center justify-center gap-8 sm:-mx-6 lg:-mx-10">
        <div className="w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-950/95 p-10 text-center shadow-2xl">
            <h1 className="text-3xl font-semibold text-white">Choose what page you want</h1>
            {mode === "admin" ? ( 
            <div className="mt-4 text-sm text-slate-400">
                <div>Panel to manipulate tables</div>
                <div>Reservation let you check the whole restaurant reservation.</div>
            </div>
            ): mode === "client" ? (
            <div className="mt-4 text-sm text-slate-400">
                <div>Panel mode lets you browse tables and book reservation.</div>
                <div>Reservation lets check you reservations booking </div>
            </div>
            ): null}
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
                type="button"
                onClick={() => handlePageSelect(true)}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 sm:w-auto"
            >
                Panel Page
            </button>
            <button
                type="button"
                onClick={() => handlePageSelect(false)}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
            >
                Reservation Page
            </button>
            </div>
        </div>
        </div>
    );
}

export default ChoosePageMode;
