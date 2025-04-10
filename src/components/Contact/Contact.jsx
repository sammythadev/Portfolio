import { motion } from 'framer-motion'
import { FaGithub, FaLinkedin, FaTwitter, FaDiscord } from 'react-icons/fa'
import { HiOutlineMail, HiPhone } from 'react-icons/hi'
import styles from './Contact.module.css'

export default function Contact() {
  const socialLinks = [
    { icon: <FaGithub />, url: 'https://github.com/sammythadev', name: 'GitHub' },
    { icon: <FaLinkedin />, url: 'https://linkedin.com/in/samuelkasper', name: 'LinkedIn' },
    { icon: <FaTwitter />, url: 'https://x.com/real_kazper', name: 'Twitter' },
    { icon: <FaDiscord />, url: 'https://discord.com/users/samuelkasper', name: 'Discord' },
    { icon: <HiOutlineMail />, url: 'mailto:samuelkasper142@gmail.com', name: 'Email' },
    { icon: <HiPhone />, url: 'tel:+2348122296701', name: 'Phone' },
  ]

  return (
    <section id="contact" className={styles.contact}>
      <div className="container">
        <h2 className="section-title">Get In Touch</h2>
        
        <div className={styles.contactContent}>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={styles.contactInfo}
          >
            <h3>Let's build something amazing together</h3>
            <p>
              I'm currently available for freelance work and full-time positions. 
              Feel free to reach out!
            </p>
            
            <div className={styles.contactMethods}>
              {socialLinks.map((link, index) => (
                <a 
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  <span className={styles.contactIcon}>{link.icon}</span>
                  {link.name === 'Email' ? 'samuel@kasper.dev' : 
                   link.name === 'Phone' ? '+1 (234) 567-890' : link.url.replace('https://', '')}
                </a>
              ))}
            </div>
            
            <div className={styles.socialLinks}>
              {socialLinks.slice(0, 4).map((link, index) => (
                <a 
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={styles.contactForm}
          >
            <form>
              <div className={styles.formGroup}>
                <label htmlFor="name">Your Name</label>
                <input type="text" id="name" required />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="email">Your Email</label>
                <input type="email" id="email" required />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="message">Your Message</label>
                <textarea id="message" rows="5" required></textarea>
              </div>
              
              <button type="submit" className="btn btn-primary">
                Send Message
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}