import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar';

export default function MainLayout() {
    return (
        <div className="app-container">
            {/* 2. Añade el canvas aquí, como primer elemento */}

            {/* Tu Navbar y Outlet se quedan como estaban */}
            <Navbar />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}