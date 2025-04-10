import styles from './About.module.css'

export default function About() {
  return (
    <section id="about" className={styles.about}>
      <div className="container">
        <h2 className="section-title">About Me</h2>
        
        <div className={styles.aboutContent}>
          <div className={styles.aboutText}>
            <p>I'm a passionate <span>Blockchain Engineer</span> and <span>Full-Stack Developer</span> with 5+ years of experience building decentralized applications and scalable web solutions.</p>
            <p>My expertise spans across smart contract development, DApp architecture, and creating seamless user experiences with modern web technologies.</p>
            
            <div className={styles.experienceGrid}>
              <div className={styles.experienceItem}>
                <h3>50+</h3>
                <p>Projects Completed</p>
              </div>
              <div className={styles.experienceItem}>
                <h3>5+</h3>
                <p>Years Experience</p>
              </div>
              <div className={styles.experienceItem}>
                <h3>30+</h3>
                <p>Happy Clients</p>
              </div>
            </div>
          </div>
          
          <div className={styles.aboutImage}>
            <img src="/about-image.jpg" alt="Samuel Kasper working" />
          </div>
        </div>
      </div>
    </section>
  )
}