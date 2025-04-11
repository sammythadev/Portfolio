import { skills } from '../../data/skills.js';
import styles from './Skills.module.css';

export default function Skills() {
  return (
    <section id="skills" className={styles.skills}>
      <div className="container">
        <h2 className="section-title">My Skills</h2>
        
        <div className={styles.skillsContainer}>
          {skills.map((category) => (
            <div key={category.title} className={styles.skillCategory}>
              <h3 className={styles.categoryTitle}>
                <span className={styles.categoryIcon}>{category.icon}</span>
                {category.title}
              </h3>
              <ul className={styles.skillsList}>
                {category.items.map((skill) => (
                  <li key={skill.name} className={styles.skillItem}>
                    {skill.icon && (
                      <span className={styles.skillIcon}>{skill.icon}</span>
                    )}
                    <div className={styles.skillInfo}>
                      <span className={styles.skillName}>{skill.name}</span>
                      <div className={styles.skillBar}>
                        <div 
                          className={styles.skillLevel}
                          style={{ width: `${skill.level}%` }}
                        ></div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}