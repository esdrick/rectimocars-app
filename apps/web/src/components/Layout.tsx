import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>
      <Navbar />

      <style>
        {`
          main h2 { margin: 0 0 8px; }
          main h3 { margin: 0 0 8px; }
        `}
      </style>

      <main
        style={{
          padding: 20,
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
