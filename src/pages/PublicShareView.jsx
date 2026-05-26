import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const getAutoLayout = (items) => {
  let currentX = 0;
  let currentY = 0;
  return items.map((item) => {
    if (item.gridLayout) return item.gridLayout;
    const w = item.size === 'large' ? 3 : item.size === 'medium' ? 2 : 1;
    if (currentX + w > 3) {
      currentX = 0;
      currentY += 2;
    }
    const layout = { i: item.id, x: currentX, y: currentY, w, h: 2 };
    currentX += w;
    return layout;
  });
};

export default function PublicShareView() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const mainRef = useRef(null);
  const [mainWidth, setMainWidth] = useState(1200);

  useEffect(() => {
    if (!loading && mainRef.current) {
      setMainWidth(mainRef.current.offsetWidth);
      const observer = new ResizeObserver(entries => {
        if (entries[0]) setMainWidth(entries[0].contentRect.width);
      });
      observer.observe(mainRef.current);
      return () => observer.disconnect();
    }
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const slugDoc = await getDoc(doc(db, 'slugs', slug));
        if (!slugDoc.exists()) {
          setError('糟糕！找不到此網頁。這可能是一個無效的網址。');
          setLoading(false);
          return;
        }
        
        const uid = slugDoc.data().uid;
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          setData(userDoc.data());
        } else {
          setError('網頁資料已遺失。');
        }
      } catch (err) {
        setError('系統發生錯誤: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>{error}</h2>
        <Link to="/" style={{ color: 'var(--primary-color)', textDecoration: 'underline', marginTop: '20px', display: 'inline-block' }}>回首頁</Link>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <img src={data.profile.avatarUrl} alt="Logo" className="sidebar-logo" />
        <h1 className="sidebar-name">{data.profile.name}</h1>

        <ul className="nav-menu">
          {data.sections.map(sec => (
            <li key={sec.id} className="nav-item">
              <a href={`#${sec.id}`} onClick={() => setActiveSectionId(sec.id)}>{sec.title}</a>
            </li>
          ))}
        </ul>
        
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', fontSize: '0.9rem', color: '#666' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            {data.profile.phone && <div>📞 {data.profile.phone}</div>}
            {data.profile.email && <div>✉️ <a href={`mailto:${data.profile.email}`} style={{ textDecoration: 'underline' }}>{data.profile.email}</a></div>}
          </div>
        </div>
      </aside>

      <main className="main-content" ref={mainRef}>
        {data.sections.map(section => (
          <section key={section.id} id={section.id} className="section">
            <h2 className="section-title">{section.title}</h2>

            <Responsive
              className="layout"
              width={mainWidth || 1200}
              layouts={{ lg: getAutoLayout(section.items) }}
              breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
              cols={{lg: 3, md: 3, sm: 2, xs: 1, xxs: 1}}
              rowHeight={150}
              margin={[30, 40]}
              isDraggable={false}
              isResizable={false}
              useCSSTransforms={true}
            >
              {section.items.map(item => {
                const itemSize = item.size || 'small';
                const itemType = item.type || 'image';

                const CardWrapper = (itemType === 'link' && item.url) ? 'a' : 'div';
                const wrapperProps = (itemType === 'link' && item.url) ? { href: item.url, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } } : {};

                return (
                  <CardWrapper key={item.id} className={`card`} style={{ height: '100%' }} {...wrapperProps}>
                    
                    {/* Image or Link Block */}
                    {(itemType === 'image' || itemType === 'link') && (
                      <div className="card-image-wrapper">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="card-image" />
                        ) : (
                          <div className="card-image" style={{ background: '#eee' }} />
                        )}
                      </div>
                    )}

                    {/* Text Block */}
                    {itemType === 'text' && (
                      <div className="card-text-only" style={{ position: 'relative' }}>
                        <div className="card-text-content">{item.textContent}</div>
                      </div>
                    )}

                    <div className="card-content-area" style={{ display: itemType === 'text' ? 'none' : 'flex' }}>
                      <h3 className="card-title">
                        {item.title}
                        {itemType === 'link' && <span style={{ fontSize: '0.8rem', color: '#8a63d2', marginLeft: '8px' }}>↗</span>}
                      </h3>
                      <span className="card-date">{item.date}</span>
                    </div>

                    {itemType === 'text' && (
                      <div style={{ padding: '0 25px 25px 25px', display: 'flex', flexDirection: 'column' }}>
                        <h3 className="card-title">{item.title}</h3>
                        <span className="card-date">{item.date}</span>
                      </div>
                    )}
                  </CardWrapper>
                );
              })}
            </Responsive>
            {section.items.length === 0 && (
              <div style={{ color: '#aaa', fontStyle: 'italic', marginTop: '20px' }}>尚無作品。</div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
