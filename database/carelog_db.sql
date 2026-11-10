--
-- PostgreSQL database dump
--

\restrict 3GBENReevTdZIPMKzzP2KliXadOyvgOlybFybcGCzF3CxEqxTIa40qH6UGLhOwR

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-11-10 23:29:55

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 16407)
-- Name: examinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.examinations (
    id integer NOT NULL,
    resident_id integer NOT NULL,
    examination_date date NOT NULL,
    weight numeric(5,2),
    height numeric(5,2),
    head_circumference numeric(5,2),
    arm_circumference numeric(5,2),
    blood_pressure character varying(20),
    abdominal_circumference numeric(5,2),
    immunization_status text,
    vitamin_status text,
    fundal_height numeric(5,2),
    gestational_age integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.examinations OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16406)
-- Name: examinations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.examinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.examinations_id_seq OWNER TO postgres;

--
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 221
-- Name: examinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.examinations_id_seq OWNED BY public.examinations.id;


--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: residents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.residents (
    id integer NOT NULL,
    nik character varying(16) NOT NULL,
    name character varying(100) NOT NULL,
    birth_date date NOT NULL,
    gender character varying(20),
    category character varying(30) NOT NULL,
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.residents OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: residents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.residents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.residents_id_seq OWNER TO postgres;

--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 219
-- Name: residents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.residents_id_seq OWNED BY public.residents.id;


--
-- TOC entry 4863 (class 2604 OID 16410)
-- Name: examinations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.examinations ALTER COLUMN id SET DEFAULT nextval('public.examinations_id_seq'::regclass);


--
-- TOC entry 4861 (class 2604 OID 16393)
-- Name: residents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.residents ALTER COLUMN id SET DEFAULT nextval('public.residents_id_seq'::regclass);


--
-- TOC entry 5022 (class 0 OID 16407)
-- Dependencies: 222
-- Data for Name: examinations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.examinations (id, resident_id, examination_date, weight, height, head_circumference, arm_circumference, blood_pressure, abdominal_circumference, immunization_status, vitamin_status, fundal_height, gestational_age, created_at) FROM stdin;
1	1	2026-11-10	12.50	85.00	48.00	12.81	\N	\N	Lengkap	Sudah diberikan	\N	\N	2026-11-10 23:00:47.424621
2	1	2026-11-10	13.50	86.00	48.00	13.00	\N	\N	Lengkap	Sudah diberikan	\N	\N	2026-11-10 23:24:49.487371
\.


--
-- TOC entry 5020 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: residents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.residents (id, nik, name, birth_date, gender, category, address, created_at) FROM stdin;
3	3578010101010004	Dewi Anggraini	2022-08-15	Perempuan	Bayi/Balita	Surabaya	2026-11-10 15:44:57.561301
1	3578010101010001	Budi Santoso	2020-05-14	Laki-laki	Bayi/Balita	Surabaya Barat	2026-11-10 14:05:00.707559
\.


--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 221
-- Name: examinations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.examinations_id_seq', 2, true);


--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 219
-- Name: residents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.residents_id_seq', 4, true);


--
-- TOC entry 4870 (class 2606 OID 16418)
-- Name: examinations examinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT examinations_pkey PRIMARY KEY (id);


--
-- TOC entry 4866 (class 2606 OID 16405)
-- Name: residents residents_nik_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.residents
    ADD CONSTRAINT residents_nik_key UNIQUE (nik);


--
-- TOC entry 4868 (class 2606 OID 16403)
-- Name: residents residents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.residents
    ADD CONSTRAINT residents_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 2606 OID 16419)
-- Name: examinations fk_resident; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT fk_resident FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE;


-- Completed on 2026-11-10 23:29:56

--
-- PostgreSQL database dump complete
--

\unrestrict 3GBENReevTdZIPMKzzP2KliXadOyvgOlybFybcGCzF3CxEqxTIa40qH6UGLhOwR

