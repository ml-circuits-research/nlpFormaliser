% EVL loader + integrity checker (the "executable" side of the DSL).
%
% Usage: swipl -q evl.pl <file.pl>
% Reads the facts WITHOUT executing them, validates them against the EVL
% signature, runs integrity constraints, and prints JSON to stdout:
%   {"ok": bool, "facts": [...], "errors": [...], "warnings": [...]}

:- use_module(library(http/json)).
:- use_module(library(lists)).
:- use_module(library(apply)).

:- initialization(main, main).

:- dynamic fact/1, err/1, warn/1.

% ---------------------------------------------------------------- signature
sig(inst, 2). sig(name, 2). sig(pron, 2). sig(prop, 2). sig(quant, 2).
sig(plural, 1). sig(rel, 3). sig(restrict, 2).
sig(event, 2). sig(role, 3). sig(tense, 2). sig(aspect, 2). sig(modal, 2).
sig(neg, 1). sig(voice, 2). sig(link, 3).
sig(kind, 2).

roles([agent, experiencer, patient, theme, stimulus, recipient, beneficiary,
       instrument, location, source, destination, path, time, manner, purpose,
       cause, topic, companion, content, attribute, standard, extent]).
pronouns([i, you, he, she, it, we, they]).
tenses([past, present, future]).
aspects([progressive, perfect, perfect_progressive]).
modals([can, could, must, may, might, should, would]).
conns([and, but, because, if, when, before, after, while, although, so, unless, until]).
quants([a, the, every, all, some, no, most, many, few, several, any, this, that,
        these, those, both, each, bare]).

% ---------------------------------------------------------------- reading
main :-
    current_prolog_flag(argv, [File|_]),
    catch(read_all(File), E, (message_to_codes(E, S), assertz(err(S)))),
    check_all,
    emit.

message_to_codes(error(syntax_error(M), stream(_, L, C, _)), S) :- !,
    format(string(S), "syntax error: ~w (line ~w, col ~w)", [M, L, C]).
message_to_codes(error(syntax_error(M), _), S) :- !, format(string(S), "syntax error: ~w", [M]).
message_to_codes(E, S) :- format(string(S), "~q", [E]).

read_all(File) :-
    setup_call_cleanup(open(File, read, In), read_terms(In), close(In)).

read_terms(In) :-
    line_count(In, Line0),
    catch(read_term(In, T, [syntax_errors(error)]), E,
          (message_to_codes(E, S0), Line is Line0 + 1,
           format(string(S), "~w (near line ~w)", [S0, Line]), assertz(err(S)), T = '$skip')),
    (   T == end_of_file -> true
    ;   T == '$skip' -> read_terms(In)
    ;   add_term(T), read_terms(In)
    ).

add_term((A, B)) :- !, add_term(A), add_term(B).
add_term((:- _)) :- !.
add_term((H :- _)) :- !, format(string(S), "rules are not allowed (only ground facts): ~q", [H]), assertz(err(S)).
add_term(T) :-
    (   \+ ground(T)
    ->  format(string(S), "fact is not ground (variables not allowed): ~q", [T]), assertz(err(S))
    ;   functor(T, F, N),
        (   sig(F, N) -> assertz(fact(T))
        ;   format(string(S), "unknown predicate ~w/~w ignored: ~q", [F, N, T]), assertz(warn(S)), assertz(fact(T))
        )
    ).

% ---------------------------------------------------------------- integrity
entity(X) :- fact(inst(X, _)) ; fact(name(X, _)) ; fact(pron(X, _)).
ev(E) :- fact(event(E, _)).

check_all :-
    forall(check(Msg), (format(string(S), "~w", [Msg]), (err(S) -> true ; assertz(err(S))))).

check(M) :- fact(role(E, R, _)), \+ ev(E), format(string(M), "role/3 on undeclared event ~w (role ~w)", [E, R]).
check(M) :- fact(role(_, R, _)), \+ valid_role(R), format(string(M), "unknown role ~q", [R]).
check(M) :- fact(role(E, R, A)), id_like(A), \+ entity(A), \+ ev(A),
            format(string(M), "~w of ~w is ~w, which is neither a declared entity nor event", [R, E, A]).
check(M) :- fact(role(E, content, A)), \+ ev(A), \+ entity(A), format(string(M), "content of ~w must be an event id, got ~q", [E, A]).
check(M) :- member(P, [prop, quant, plural, rel, restrict]), fact(T), T =.. [P, X|_],
            \+ entity(X), format(string(M), "~w/_ on undeclared entity ~w (needs inst/name/pron)", [P, X]).
check(M) :- fact(rel(_, _, Y)), \+ entity(Y), format(string(M), "rel/3 target ~w is not a declared entity", [Y]).
check(M) :- fact(restrict(_, E)), \+ ev(E), format(string(M), "restrict/2 refers to undeclared event ~w", [E]).
check(M) :- member(P, [tense, aspect, modal, neg, voice]), fact(T), T =.. [P, E|_],
            \+ ev(E), format(string(M), "~w/_ on undeclared event ~w", [P, E]).
check(M) :- fact(link(A, _, B)), member(E, [A, B]), \+ ev(E), format(string(M), "link/3 refers to undeclared event ~w", [E]).
check(M) :- fact(link(_, C, _)), conns(Cs), \+ memberchk(C, Cs), format(string(M), "unknown connective ~q", [C]).
check(M) :- fact(tense(E, T)), tenses(Ts), \+ memberchk(T, Ts), format(string(M), "bad tense ~q for ~w", [T, E]).
check(M) :- fact(aspect(E, T)), aspects(Ts), \+ memberchk(T, Ts), format(string(M), "bad aspect ~q for ~w", [T, E]).
check(M) :- fact(modal(E, T)), modals(Ts), \+ memberchk(T, Ts), format(string(M), "bad modal ~q for ~w", [T, E]).
check(M) :- fact(pron(X, P)), pronouns(Ps), \+ memberchk(P, Ps), format(string(M), "bad pronoun ~q for ~w", [P, X]).
check(M) :- fact(quant(X, Q)), \+ integer(Q), quants(Qs), \+ memberchk(Q, Qs), format(string(M), "bad quantifier ~q for ~w", [Q, X]).
check(M) :- fact(T), lexical_arg(T, C), \+ lemma_ok(C),
            format(string(M), "~q is not a single lemma (phrases/sentences are not allowed as concepts)", [C]).
check(M) :- fact(event(E, V1)), fact(event(E, V2)), V1 @< V2, format(string(M), "event ~w has two types (~w, ~w)", [E, V1, V2]).

valid_role(pp(P)) :- atom(P), !.
valid_role(R) :- roles(Rs), memberchk(R, Rs).

id_like(A) :- atom(A), atom_codes(A, [C|Rest]), memberchk(C, `xe`), Rest \== [], forall(member(D, Rest), code_type(D, digit)).

lexical_arg(inst(_, C), C).
lexical_arg(event(_, C), C).
lexical_arg(prop(_, C), C).
lexical_arg(kind(C, _), C).
lexical_arg(role(_, _, A), C) :- \+ id_like(A), sub_lemma(A, C).
lexical_arg(rel(_, R, _), R).

% atoms nested inside role arguments, e.g. more(tall) -> tall, more_than(forty_hours_per_week) -> both parts
sub_lemma(A, A) :- atom(A).
sub_lemma(T, C) :- compound(T), T =.. [F|Args], ( C = F ; member(X, Args), sub_lemma(X, C) ).

lemma_ok(very(C)) :- !, lemma_ok(C).
lemma_ok(C) :- number(C), !.
lemma_ok(C) :- string(C), !, fail.
lemma_ok(C) :- atom(C), atomic_list_concat(Parts, '_', C), length(Parts, N), N =< 3,
               \+ sub_atom(C, _, _, _, ' ').

% ---------------------------------------------------------------- output
term_json(T, T) :- atom(T), !.
term_json(T, T) :- number(T), !.
term_json(T, S) :- string(T), !, S = T.
term_json(T, json([f=F, a=As])) :- compound(T), T =.. [F|Args], maplist(term_json, Args, As).

emit :-
    findall(J, (fact(T), T =.. L, maplist(term_json, L, J)), Facts),
    findall(E, err(E), Errs), findall(W, warn(W), Warns),
    ( Errs == [] -> Ok = true ; Ok = false ),
    json_write(current_output, json([ok=Ok, facts=Facts, errors=Errs, warnings=Warns]), [width(0)]),
    nl.
