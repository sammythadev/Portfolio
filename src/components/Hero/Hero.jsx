import styles from './Hero.module.css'
import { motion } from 'framer-motion'

export default function Hero() {
  return (
    <section className={styles.hero}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={styles.content}
      >
        <h1>Samuel Kasper</h1>
        <h2 className="font-mono">Blockchain & Full-Stack Developer</h2>
      </motion.div>
    </section>
  )
}
