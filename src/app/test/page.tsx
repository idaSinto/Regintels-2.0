import React from 'react';
import Image from 'next/image';

// Define the shape of your newsletter data
interface Article {
  title: string;
  summary: string;
  imageUrl: string;
  link: string;
}

const NewsletterEmail: React.FC = () => {
  const articles: Article[] = [
    {
      title: 'UK REACH Deadline Further Postponed',
      summary:
        'On December 22, 2025, the UK Department for Environment, Food and Rural Affairs (Defra) released a summary report announcing a comprehensive three-year postponement of the final deadlines.',
      imageUrl: 'https://via.placeholder.com/223x150',
      link: 'https://example.com/uk-reach'
    },
    {
      title: 'EU Releases New Toy Safety Regulation',
      summary:
        'The Official Journal of the European Union published the new EU Toy Safety Regulation (Regulation (EU) 2025/2509). This will replace Directive 2009/48/EC.',
      imageUrl: 'https://via.placeholder.com/223x150',
      link: 'https://example.com/eu-toy-safety'
    }
  ];

  return (
    <div style={{ backgroundColor: '#474747', padding: '20px 0', minHeight: '100vh', width: '100%' }}>
      {/* Note: For actual email sending, you would extract the inner <table>
          and send that as the HTML body.
      */}
      <table
        align="center"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        width="700"
        style={{ backgroundColor: '#ffffff', borderCollapse: 'collapse', margin: '0 auto' }}
      >
        <tbody>
          {/* Header Bar */}
          <tr style={{ backgroundColor: '#3C8BFF' }}>
            <td style={{ padding: '10px 48px', textAlign: 'right', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
              Vol. 245 — Jan 5, 2026
            </td>
          </tr>

          {/* Banner Image */}
          <tr>
            <td style={{ padding: 0 }}>
              <Image
                src="https://via.placeholder.com/700x180"
                alt="Banner"
                width={700}
                height={180}
                unoptimized
                style={{ width: '700px', height: 'auto', display: 'block', border: '0' }}
              />
            </td>
          </tr>

          {/* Section Heading */}
          <tr>
            <td style={{ padding: '30px 40px 10px', textAlign: 'center', color: '#3C8BFF', fontFamily: 'Arial, sans-serif', fontSize: '28px', fontWeight: 'bold' }}>
              REGULATORY UPDATES
            </td>
          </tr>

          {/* Article Mapping */}
          {articles.map((item, index) => (
            <React.Fragment key={index}>
              <tr>
                <td style={{ padding: '20px 0' }}>
                  <table width="100%" border={0} cellPadding={0} cellSpacing={0}>
                    <tbody>
                      <tr>
                        {/* Text Column */}
                        <td width="65%" style={{ padding: '0 48px', verticalAlign: 'top', fontFamily: 'Arial, sans-serif' }}>
                          <h3 style={{ fontSize: '16px', color: '#000000', margin: '0 0 10px 0', lineHeight: '1.2' }}>
                            {item.title}
                          </h3>
                          <p style={{ fontSize: '14px', color: '#525150', textAlign: 'justify', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                            {item.summary}
                          </p>
                          <a href={item.link} style={{ color: '#2C74FF', fontWeight: 'bold', fontSize: '14px', textDecoration: 'underline' }}>
                            Learn more
                          </a>
                        </td>
                        {/* Image Column */}
                        <td width="35%" align="center" style={{ verticalAlign: 'top', paddingRight: '20px' }}>
                          <Image
                            src={item.imageUrl}
                            alt="Article"
                            width={223}
                            height={150}
                            unoptimized
                            style={{ width: '223px', height: 'auto', borderRadius: '4px', display: 'block' }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              {/* Divider (doesn't show after the last item) */}
              {index < articles.length - 1 && (
                <tr>
                  <td style={{ padding: '0 48px' }}>
                    <hr style={{ border: '0', borderTop: '1px solid #eeeeee' }} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}

          {/* Footer */}
          <tr>
            <td style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9f9f9', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#888888' }}>
              <p>© 2026 CIRS Group. All rights reserved.</p>
              <p>
                <a href="#" style={{ color: '#3C8BFF', textDecoration: 'none' }}>Unsubscribe</a> |
                <a href="#" style={{ color: '#3C8BFF', textDecoration: 'none', marginLeft: '10px' }}>View Online</a>
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default NewsletterEmail;
