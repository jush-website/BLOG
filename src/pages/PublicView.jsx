import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FaInstagram, FaEnvelope } from 'react-icons/fa';

const ADMIN_DOC_ID = "admin_profile";

function PublicView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', ADMIN_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching document:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>載入中...</div>;

  // Defaults if no data exists yet (to show what it looks like before editing)
  const profile = data || {
    headerImageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1000&auto=format&fit=crop",
    name: "孫泗萍 Sun Shih Ping",
    subtitle: "當代油畫創作 | 王與相系列",
    bioBlocks: [
      "孫泗萍\n\n當代油畫創作\n以牡丹與芍藥延伸「王與相」系列\n探討權力、身份與人際關係\n\n法國藝術家沙龍入選\n羅浮宮國際藝術展入選\n多件作品獲典藏",
      "王與相\n\n牡丹與芍藥不只是花卉\n\n在創作中\n它們象徵權力、身分、關係與人性\n\n「王」與「相」並非對立\n而是在權力與依附之間\n共同構成一種微妙平衡"
    ],
    portfolioLinks: [
      { title: "最新展覽資訊與時間", subtitle: "Latest Exhibition Information", imageUrl: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=500&auto=format&fit=crop", url: "#" },
      { title: "酒精墨水畫作品集", subtitle: "Alcohol Ink Painting Portfolio", imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=500&auto=format&fit=crop", url: "#" }
    ],
    igUrl: "#",
    email: "hello@example.com"
  };

  return (
    <div className="public-container">
      <header className="header-banner" style={{ backgroundImage: `url(${profile.headerImageUrl})` }}>
        <div className="header-gradient"></div>
        <div className="header-content">
          <h1 className="header-name">{profile.name}</h1>
          <p className="header-subtitle">{profile.subtitle}</p>
          <div className="header-socials">
            {profile.email && <a href={`mailto:${profile.email}`}><FaEnvelope /></a>}
            {profile.igUrl && <a href={profile.igUrl} target="_blank" rel="noopener noreferrer"><FaInstagram /></a>}
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Bio Cards */}
        {profile.bioBlocks && profile.bioBlocks.map((text, idx) => (
          <div key={idx} className="text-card">
            {text.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p> /* \u00A0 preserves empty lines for spacing */
            ))}
          </div>
        ))}

        {/* Portfolio Links (Alternating Layout) */}
        {profile.portfolioLinks && profile.portfolioLinks.map((link, idx) => {
          const isImageRight = idx % 2 === 0;
          return (
            <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="image-link-card" style={{ flexDirection: isImageRight ? 'row' : 'row-reverse' }}>
              <div className="card-text-area" style={{ textAlign: isImageRight ? 'left' : 'right' }}>
                <div className="card-title">{link.title}</div>
                {link.subtitle && <div className="card-subtitle">{link.subtitle}</div>}
              </div>
              <div className="card-image-area">
                <img src={link.imageUrl} alt={link.title} />
              </div>
            </a>
          );
        })}
      </main>
      
      <div style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '20px' }}>
        <a href="/login" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', textDecoration: 'none' }}>Admin Login</a>
      </div>
    </div>
  );
}

export default PublicView;
