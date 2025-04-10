import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section id="hero" className={styles.hero}>
      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.heroContent}>
          <h1>Hi, I'm <span>Samuel Kasper</span></h1>
          <h2 className="font-mono">Blockchain & Full-Stack Developer</h2>
          <p>Building decentralized applications and scalable web solutions</p>
          <div className={styles.heroButtons}>
            <a href="#projects" className="btn btn-primary">View My Work</a>
            <a href="#contact" className="btn btn-secondary">Contact Me</a>
          </div>
        </div>
        
        <div className={styles.heroImage}>
          <div className={styles.glowingOrb}></div>
          <img src="/profile.jpeg" alt="Samuel Kasper" />
        </div>
      </div>
    </section>
  )
}