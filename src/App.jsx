import { BrowserRouter, Route, Routes } from "react-router-dom";
import Main_Page from "./Main_Page";
import Login from "./Login";

// export const serverRoute = "http://localhost:8080";
export const serverRoute = "https://sahr-se.onrender.com";
export const token = localStorage.getItem("token");
function App() {
  return (
    <div className="w-full flex items-center justify-center">
      <BrowserRouter>
        <Routes>
          <Route element={<Main_Page />} path="/" />
          <Route element={<Login />} path="/login" />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
