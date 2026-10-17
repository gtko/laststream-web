// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';
import styles from './styles.less';

type Props = {
    id: string;
    title: string;
    children: React.ReactNode;
    sectionRef?: React.Ref<HTMLElement>;
};

const Section = ({ id, title, children, sectionRef }: Props) => (
    <section ref={sectionRef} className={styles['section']} id={id} aria-labelledby={`${id}-title`}>
        <h2 className={styles['section-title']} id={`${id}-title`}>{title}</h2>
        {children}
    </section>
);

export default Section;
