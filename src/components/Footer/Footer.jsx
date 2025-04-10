import styles from './Footer.module.css'
import { socialLinks } from '../../data/socialLinks'

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerContent}>
          <p>&copy; {new Date().getFullYear()} Samuel Kasper. All rights reserved.</p>
          
          <div className={styles.footerSocial}>
            {socialLinks.map((link) => (
              <a 
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label={link.name}
              >
                <span className={`${styles.socialIcon} ${styles[link.icon]}`}></span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer