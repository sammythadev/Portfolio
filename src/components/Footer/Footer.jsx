import { motion } from 'framer-motion'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={styles.footer}
    >
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Samuel Kasper. All rights reserved.</p>
      </div>
    </motion.footer>
  )
}