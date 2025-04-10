import styles from './Contact.module.css'
import { socialLinks } from '../../data/socialLinks'

const Contact = () => {
  return (
    <section id="contact" className={styles.contact}>
      <div className="container">
        <h2 className="section-title">Get In Touch</h2>
        
        <div className={styles.contactContent}>
          <div className={styles.contactInfo}>
            <h3>Let's build something amazing together</h3>
            <p>I'm available for freelance work and full-time positions.</p>
            
            <div className={styles.contactMethods}>
              {socialLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  <span className={`${styles.socialIcon} ${styles[link.icon]}`}></span>
                  {link.name === 'Email' ? 'samuel@kasper.dev' : link.name}
                </a>
              ))}
            </div>
          </div>
          
          <form className={styles.contactForm}>
            <div className={styles.formGroup}>
              <input type="text" placeholder="Your Name" required />
            </div>
            <div className={styles.formGroup}>
              <input type="email" placeholder="Your Email" required />
            </div>
            <div className={styles.formGroup}>
              <textarea placeholder="Your Message" required></textarea>
            </div>
            <button type="submit" className="btn btn-primary">Send Message</button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default Contact