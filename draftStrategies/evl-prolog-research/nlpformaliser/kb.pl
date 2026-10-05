% EVL knowledge base + reasoning used to EXECUTE questions against formalised text.
%
% Facts are stored as fact(T) (EVL uses name/2, which is a SWI built-in, so we never
% consult EVL code directly).  qa.py compiles a question into a goal over the
% predicates below and calls answer_all/2.

:- use_module(library(http/json)).
:- use_module(library(lists)).
:- use_module(library(aggregate)).
:- dynamic fact/1.
:- discontiguous fills/4.
:- table sub/2.

load_kb(File) :-
    setup_call_cleanup(open(File, read, In), rd(In), close(In)).
rd(In) :- read_term(In, T, []), ( T == end_of_file -> true ; add(T), rd(In) ).
add((A, B)) :- !, add(A), add(B).
add((:- _)) :- !.
add(T) :- assertz(fact(T)).

% ------------------------------------------------------------ taxonomy
direct_sub(C, S) :- fact(kind(C, S)).
direct_sub(C, S) :- gen_isa(C, S).
sub(C, S) :- direct_sub(C, S).
sub(C, S) :- sub(C, M), direct_sub(M, S).

% "Whales are mammals" (generic, positive copula with an entity attribute) => whale ⊑ mammal
gen_isa(C1, C2) :-
    fact(event(E, be)), \+ fact(neg(E)), fact(role(E, theme, X)), generic_ent(X, Q), Q \== no,
    \+ fact(restrict(X, _)), fact(inst(X, C1)), fact(role(E, attribute, Y)), atom(Y), fact(inst(Y, C2)).
% "Whales are not fish" => disjoint
gen_not_isa(C1, C2) :-
    fact(event(E, be)), fact(role(E, theme, X)), generic_ent(X, _), fact(inst(X, C1)),
    fact(role(E, attribute, Y)), atom(Y), fact(inst(Y, C2)),
    ( fact(neg(E)) ; fact(quant(X, no)) ).

generic_ent(X, Q) :- fact(quant(X, Q)), memberchk(Q, [bare, all, every, each, most, many, any, few, no]).
generic_ent(X, bare) :- \+ fact(quant(X, _)), fact(plural(X)), fact(role(E, _, X)), fact(generic(E)).

isa(X, C) :- fact(inst(X, C)).
isa(X, C) :- fact(inst(X, C0)), sub(C0, C).
isa(X, U) :- fact(measure(X, _, U)).
not_isa(X, C) :- fact(inst(X, C0)), ( C1 = C0 ; sub(C0, C1) ), gen_not_isa(C1, C).

% distance from an individual to a class (for "most specific class wins")
dist(X, C, 0) :- fact(inst(X, C)), !.
dist(X, C, D) :- aggregate_all(min(D0), (fact(inst(X, C0)), path(C0, C, D0, 6)), D), number(D).
path(C, S, 1, _) :- direct_sub(C, S).
path(C, S, D, Max) :- Max > 1, direct_sub(C, M), M1 is Max - 1, path(M, S, D0, M1), D is D0 + 1.

% ------------------------------------------------------------ events
ev_type(E, V) :- fact(event(E, V)).
ev_type(E, V) :- fact(event(E, V0)), V0 \== V, sub(V0, V).

eqclass([agent, experiencer]).
eqclass([theme, patient, stimulus]).
eqclass([location, pp(in), pp(at), pp(on)]).
eqclass([destination, pp(to)]).
eqclass([duration, extent, pp(for)]).
eqclass([recipient, pp(to)]).
role_eq(R, R).
role_eq(R1, R2) :- eqclass(L), memberchk(R1, L), memberchk(R2, L), R1 \== R2.

same_ref(A, A).
same_ref(G, A) :- fact(group(G, L)), memberchk(A, L).

% an event is asserted as true by the text (not merely believed, conditional, counterfactual, asked...)
embedded(E) :- fact(role(_, content, E)).
embedded(E) :- fact(link(_, C, E)), memberchk(C, [if, unless]).
embedded(E) :- fact(link(E, C, _)), memberchk(C, [if, unless]).
embedded(E) :- fact(counterfactual(E)).
embedded(E) :- fact(act(_, _, E)).
embedded(E) :- fact(restrict(X, E)), generic_ent(X, _).
asserted(E) :- fact(event(E, _)), \+ embedded(E).

% conditional consequent made true by modus ponens: link(E1, if, E2) and an asserted event matching E2
derived(E1) :- fact(link(E1, if, E2)), asserted(E3), E3 \== E2, match_event(E2, E3).

match_event(P, E) :-
    fact(event(P, V)), ev_type(E, V),
    ( fact(neg(P)) -> fact(neg(E)) ; \+ fact(neg(E)) ),
    forall(( fact(role(P, R, A)), \+ memberchk(R, [time, manner]) ),
           ( fact(role(E, R2, B)), role_eq(R2, R), similar(A, B) )).

similar(A, A) :- !.
similar(A, B) :- fact(name(A, N)), fact(name(B, N)), !.
similar(A, B) :- fact(pron(A, P)), fact(pron(B, P)), !.
similar(A, B) :- fact(inst(A, C)), isa(B, C), !.
similar(A, B) :- fact(measure(A, NA, U)), fact(measure(B, NB, U)), amount_ok(NB, NA).

amount_ok(N, N) :- number(N), !.
amount_ok(N, more_than(T)) :- number(N), N > T.
amount_ok(N, less_than(T)) :- number(N), N < T.
amount_ok(N, at_least(T)) :- number(N), N >= T.
amount_ok(N, at_most(T)) :- number(N), N =< T.
amount_ok(N, exactly(T)) :- number(N), N =:= T.

% ------------------------------------------------------------ participation
% fills(E, Role, A, Mode): A plays Role in context event E.
%   Mode = direct            the text says so about A (or a group containing A)
%   Mode = gen(C, Q, D)      A inherits it from a generic statement about class C (quantifier Q),
%                            D = taxonomic distance from A to C (smaller = more specific)
fills(E, R, A, direct) :-
    fact(role(E, R2, A2)), role_eq(R2, R), same_ref(A2, A).
fills(E, R, A, gen(C, Q, D)) :-
    nonvar(A), fact(role(E, R2, G)), role_eq(R2, R), G \== A,
    generic_ent(G, Q), \+ fact(scope(neg(E), G)),
    fact(inst(G, C)), isa(A, C), \+ fact(group(G, _)),
    satisfies_restrictions(A, G),
    dist(A, C, D).

% the individual A satisfies the relative clauses of the generic entity G
% ("every student WHO PASSED THE EXAM", "employees WHO WORK MORE THAN 40 HOURS")
satisfies_restrictions(A, G) :-
    forall(fact(restrict(G, P)),
           ( fact(event(P, V)), ev_type(E, V), E \== P, asserted(E),
             ( fact(neg(P)) -> fact(neg(E)) ; \+ fact(neg(E)) ),
             forall(( fact(role(P, R, B)), \+ memberchk(R, [time, manner]) ),
                    ( B == G -> ( fact(role(E, R2, A2)), role_eq(R2, R), same_ref(A2, A) )
                    ; ( fact(role(E, R2, B2)), role_eq(R2, R), similar(B, B2) ) )) )).

polarity(E, neg) :- fact(neg(E)), !.
polarity(_, pos).

status(E, asserted) :- asserted(E), !.
status(E, derived) :- derived(E), !.
status(E, generic) :- fact(generic(E)), !.
status(_, embedded).

attr(X, A) :- fact(prop(X, A)).
attr(X, A) :- fact(event(E, be)), fact(role(E, theme, X)), fact(role(E, attribute, A)), \+ fact(neg(E)).

cause_of(E, W) :- fact(role(E, cause, W)).
cause_of(E, W) :- fact(link(E, because, W)).
cause_of(E, W) :- fact(link(W, so, E)).
cause_of(E, W) :- fact(role(E, purpose, W)).

% ------------------------------------------------------------ output
term_json(T, J) :- is_list(T), !, maplist(term_json, T, J0), J = json([f='$list', a=J0]).
term_json(T, T) :- atom(T), !.
term_json(T, T) :- number(T), !.
term_json(T, S) :- string(T), !, S = T.
term_json(T, json([f=F, a=As])) :- compound(T), T =.. [F|Args], maplist(term_json, Args, As).
term_json(T, "_") :- var(T).

% print every solution of Goal as JSON of Template
emit_all(Template, Goal) :-
    findall(Template, Goal, L0), sort(L0, L),
    maplist(term_json, L, J),
    json_write(current_output, J, [width(0)]), nl.
