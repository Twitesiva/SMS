import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import bgImage from '../../assets/media/EMS.jpg';
import logo from '../../assets/media/images.png';
import './Intro.css';

export default function Intro() {
    const navigate = useNavigate();
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(true);
    }, []);

    const handleBegin = () => {
        navigate('/home');
    };

    return (
        <div className="intro-container">
            <div
                className="intro-background"
                style={{ backgroundImage: `url(${bgImage})` }}
            />
            <div className="intro-overlay" />

            <div className={`intro-content ${loaded ? 'visible' : ''}`}>
                <div className="intro-card glass-panel">
                    <img src={logo} alt="College Logo" className="intro-logo" />
                    <h1 className="intro-title">"Vijayam Arts & Science College"</h1>
                    <div className="intro-divider"></div>
                    <p className="intro-subtitle">"Smarter systems for smarter campuses.<br />Simplifying college management, enhancing success."</p>

                    <button className="intro-button btn-shine" onClick={handleBegin}>
                        <span>Let's Begin</span>
                        <div className="icon">
                            <i className="bi bi-arrow-right"></i>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
