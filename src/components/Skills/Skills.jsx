import { motion } from 'framer-motion'
import { skills } from '../../data/skills'
import styles from './Skills.module.css'

export default function Skills() {
  return (
    <section id="skills" className={styles.skills}>
      <div className="container">
        <h2 className="section-title">My Skills</h2>
        
        <div className={styles.skillsGrid}>
          {skills.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={styles.skillCategory}
            >
              <h3>{category.title}</h3>
              <ul>
                {category.items.map((skill) => (
                  <li key={skill}>
                    <span>▹</span> {skill}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
