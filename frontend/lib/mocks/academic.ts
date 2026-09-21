import type { Exam, Material, Subject, Task } from '@/lib/types/academic';
export const subjects: Subject[] = [
  { id:'dbms', name:'Database Management', code:'DBMS', progress:62, readiness:58, color:'#6C4CE8', topics:12, completedTopics:7, weakTopics:['Normalization','Transactions'] },
  { id:'maths', name:'Discrete Mathematics', code:'MATH', progress:78, readiness:74, color:'#A78BFA', topics:10, completedTopics:8, weakTopics:['Graph Theory'] },
  { id:'os', name:'Operating Systems', code:'OS', progress:45, readiness:48, color:'#C084FC', topics:11, completedTopics:5, weakTopics:['Deadlocks','Scheduling'] }
];
export const tasks: Task[] = [
  {id:'t1', title:'Normalize the library schema', subject:'DBMS', due:'Today, 6:00 PM', type:'Assignment', priority:'High'},
  {id:'t2', title:'Revise Transaction states', subject:'DBMS', due:'Tomorrow', type:'Revision', priority:'High'},
  {id:'t3', title:'Graph theory problem set', subject:'MATH', due:'Thu, Sep 24', type:'Task', priority:'Medium'},
  {id:'t4', title:'Process scheduling notes', subject:'OS', due:'Fri, Sep 25', type:'Revision', priority:'Medium'}
];
export const exams: Exam[] = [
  {id:'e1', title:'DBMS Mid-semester', subject:'DBMS', date:'Sep 27', daysAway:6, readiness:58, weakTopics:['Normalization','Transactions'], reason:'2 weak topics need revision before your exam.'},
  {id:'e2', title:'Discrete Mathematics Quiz', subject:'MATH', date:'Oct 03', daysAway:12, readiness:74, weakTopics:['Graph Theory'], reason:'Strong overall progress; schedule one Graph Theory review.'}
];
export const materials: Material[] = [
  {id:'m1',name:'Normalization Unit 3.pdf',subject:'DBMS',folder:'Unit 3',type:'PDF',size:'2.4 MB',updated:'Today'},
  {id:'m2',name:'Transaction notes',subject:'DBMS',folder:'Notes',type:'Notes',size:'860 KB',updated:'Yesterday'},
  {id:'m3',name:'Graph theory slides',subject:'MATH',folder:'Unit 2',type:'Slides',size:'4.1 MB',updated:'Sep 18'},
  {id:'m4',name:'Scheduling algorithms.pdf',subject:'OS',folder:'Unit 4',type:'PDF',size:'1.8 MB',updated:'Sep 16'}
];
